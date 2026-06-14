// Estado de conversa por lead (telefone). Em producao, troque por Redis/DB.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// STATE_FILE permite isolar o store (util em testes e em deploy com disco dedicado).
const STORE = process.env.STATE_FILE || path.resolve(__dirname, '..', 'data', 'state.json');

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

export function getLead(phone) {
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

// Remove TODO o estado de um lead (LGPD: direito ao esquecimento).
export function deleteLead(phone) {
  const existia = Object.prototype.hasOwnProperty.call(store, phone);
  delete store[phone];
  if (existia) persist();
  return existia;
}

// Enumera todos os leads (ignora chaves internas como __rotation/__paused).
export function allLeads() {
  return Object.values(store).filter((l) => l && typeof l === 'object' && l.phone);
}

// Kill-switch global: pausa/retoma o envio para TODOS os leads (operacao sem vigilancia).
export function setGlobalPause(on) {
  store.__paused = !!on;
  persist();
  return !!on;
}
export function isGlobalPaused() {
  return store.__paused === true;
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
