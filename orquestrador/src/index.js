// Servidor Express: webhooks Meta + Z-API -> processor.
import express from 'express';
import { config, assertConfig } from './config.js';
import * as meta from './whatsapp/meta.js';
import * as zapi from './whatsapp/zapi.js';
import { sendTemplate } from './whatsapp/send.js';
import { handleInbound } from './processor.js';
import { getLead, saveLead, pushHistory } from './state.js';

assertConfig();
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ===== Meta: verificacao do webhook (GET) =====
app.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== Meta: recebimento de mensagens (POST) =====
app.post('/webhook/meta', async (req, res) => {
  res.sendStatus(200); // responde rapido; processa em background
  try {
    const inbounds = meta.parseInbound(req.body);
    for (const inb of inbounds) await handleInbound(inb);
  } catch (e) {
    console.error('[webhook/meta] erro:', e.message);
  }
});

// ===== Z-API: recebimento de mensagens (POST) =====
app.post('/webhook/zapi', async (req, res) => {
  res.sendStatus(200);
  try {
    const inbounds = zapi.parseInbound(req.body);
    for (const inb of inbounds) await handleInbound(inb);
  } catch (e) {
    console.error('[webhook/zapi] erro:', e.message);
  }
});

// ===== Disparo proativo de PRIMEIRO CONTATO (template HSM via Meta) =====
// POST /outbound/first-contact  { phone, nome, empreendimento, origem, template }
app.post('/outbound/first-contact', async (req, res) => {
  const { phone, nome, empreendimento, origem, template = 'primeiro_contato_lead' } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone obrigatorio' });
  try {
    const lead = getLead(phone);
    lead.nome = nome || lead.nome;
    lead.origem = origem || lead.origem || 'outbound';
    lead.estagio = 'primeiro_contato';
    pushHistory(lead, 'assistant', `[template ${template}] primeiro contato sobre ${empreendimento || ''}`);
    saveLead(lead);
    const data = await sendTemplate(phone, template, [nome || 'tudo bem', empreendimento || 'imovel ideal']);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.listen(config.port, () => {
  console.log(`[SMQ Agent] orquestrador rodando na porta ${config.port}`);
  console.log(`  Webhook Meta: POST /webhook/meta  | verify GET /webhook/meta`);
  console.log(`  Webhook Z-API: POST /webhook/zapi`);
  console.log(`  Primeiro contato: POST /outbound/first-contact`);
});
