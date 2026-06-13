// Servidor Express: webhooks Meta + Z-API -> processor.
import express from 'express';
import { config, assertConfig } from './config.js';
import * as meta from './whatsapp/meta.js';
import * as zapi from './whatsapp/zapi.js';
import { sendTemplate, sendText } from './whatsapp/send.js';
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
    lead.agentManaged = true;
    lead.estagio = 'primeiro_contato';
    pushHistory(lead, 'assistant', `[template ${template}] primeiro contato sobre ${empreendimento || ''}`);
    saveLead(lead);
    const data = await sendTemplate(phone, template, [nome || 'tudo bem', empreendimento || 'imovel ideal']);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

// ===== PORTA DE ENTRADA: novo lead -> AGENTE PRIMEIRO (qualifica antes do corretor) =====
// O CRM/Facebook chama isto quando um lead novo entra. O agente faz o 1o contato e qualifica.
// IMPORTANTE: aqui NAO chamamos a roleta/CRM. O corretor so entra no HANDOFF (apos qualificar).
// POST /intake/new-lead { phone, nome, empreendimento, origem, faixaRenda, objetivo }
app.post('/intake/new-lead', async (req, res) => {
  const { phone, nome, empreendimento, origem = 'fb_ads', faixaRenda, objetivo, email, projectId, leadId } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'phone obrigatorio' });
  try {
    const lead = getLead(phone);
    lead.nome = nome || lead.nome;
    lead.origem = lead.origem || origem;
    if (empreendimento) lead.empreendimentoInteresse = empreendimento;
    if (faixaRenda) lead.faixaRenda = faixaRenda;
    if (objetivo) lead.objetivo = objetivo;
    if (email) lead.email = email;
    if (projectId) lead.projectId = projectId;     // id numerico do projeto no CRM (opcional)
    if (leadId) lead.crmLeadId = leadId;           // se vier do CRM (Caminho B futuro)
    lead.agentManaged = true;                      // a partir daqui o agente PODE responder este lead
    lead.estagio = 'primeiro_contato';

    // 1o contato: canal oficial usa template; Z-API usa texto G.P.V.A.
    let enviado;
    if (config.replyChannel === 'meta') {
      enviado = await sendTemplate(phone, 'primeiro_contato_lead', [nome || 'tudo bem', empreendimento || 'imovel ideal']);
    } else {
      const primeiraMsg =
        `Oi ${nome || ''}! Aqui e o time da Seu Metro Quadrado 👋 ` +
        `Vi seu interesse${empreendimento ? ' no ' + empreendimento : ''}. ` +
        `Posso te ajudar a achar a melhor opcao pro seu perfil e ja adiantar sua analise (rapida e sem compromisso)? ` +
        `Se preferir nao receber, responda SAIR.`;
      enviado = await sendText(phone, primeiraMsg, 'zapi');
      pushHistory(lead, 'assistant', primeiraMsg);
    }
    saveLead(lead);
    res.json({ ok: true, canal: config.replyChannel, enviado: !!enviado });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.listen(config.port, () => {
  console.log(`[SMQ Agent] orquestrador rodando na porta ${config.port}`);
  console.log(`  Webhook Meta: POST /webhook/meta  | verify GET /webhook/meta`);
  console.log(`  Webhook Z-API: POST /webhook/zapi`);
  console.log(`  Novo lead (agente primeiro): POST /intake/new-lead`);
  console.log(`  Primeiro contato (template): POST /outbound/first-contact`);
});
