// Estado de conversa por lead (telefone). Em producao, troque por Redis/DB.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.resolve(__dirname, '..', 'data', 'state.json');

let store = {};
try {
  store = JSON.parse(fs.readFileSync(STORE, 'utf8'));
} catch {
  store = {};
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[state] erro ao persistir', e.message);
  }
}

// Telefone canonico: so digitos com DDI 55 (ex.: 5511953979006).
// Garante que /intake, webhook Z-API/Meta e admin caiam SEMPRE no mesmo lead.
export function canonPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length >= 10 && d.length <= 11) d = '55' + d; // veio sem DDI (DDD+numero)
  return d;
}

export function getLead(phoneRaw) {
  const phone = canonPhone(phoneRaw);
  if (!store[phone]) {
    store[phone] = {
      phone,
      nome: null,
      origem: null,
      objetivo: null,
      faixaRenda: null,
      regiao: null,
      empreendimentoInteresse: null,
      temperatura: 'FRIO',
      estagio: 'primeiro_contato',
      optIn: true,
      optOut: false,
      handoff: false,
      paused: false,       // se true, o agente NAO responde este lead (controle manual)
      agentManaged: false, // so true para leads que o AGENTE iniciou (via /intake ou /outbound)
      convitesAnaliseVisita: 0,
      history: [], // {role:'user'|'assistant', content, ts}
      lastInboundTs: null,
      sentToday: [], // timestamps de mensagens enviadas (controle de rate)
      createdAt: Date.now(),
    };
  }
  return store[phone];
}

export function saveLead(lead) {
  store[lead.phone] = lead;
  persist();
}

export function pushHistory(lead, role, content) {
  lead.history.push({ role, content, ts: Date.now() });
  if (lead.history.length > 40) lead.history = lead.history.slice(-40);
}

// Janela conversacional de 24h da Meta
export function within24h(lead) {
  if (!lead.lastInboundTs) return false;
  return Date.now() - lead.lastInboundTs < 24 * 60 * 60 * 1000;
}

export function countSentLast24h(lead) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  lead.sentToday = (lead.sentToday || []).filter((t) => t > cutoff);
  return lead.sentToday.length;
}

export function markSent(lead) {
  lead.sentToday = lead.sentToday || [];
  lead.sentToday.push(Date.now());
}

// --- Roleta (round-robin) de corretores ---
// Mantemos um ponteiro por "grupo" (ex.: projeto ou regiao) persistido junto do store.
function rotState() {
  if (!store.__rotation) store.__rotation = {};
  return store.__rotation;
}

// Retorna o proximo indice da roleta para um grupo e avanca o ponteiro.
export function nextRotationIndex(groupKey, size) {
  if (!size) return 0;
  const r = rotState();
  const cur = Number.isInteger(r[groupKey]) ? r[groupKey] : -1;
  const next = (cur + 1) % size;
  r[groupKey] = next;
  persist();
  return next;
}
