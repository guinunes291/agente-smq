// Telemetria unificada: eventos estruturados por agente (observabilidade + KPIs).
// Sink padrao: JSONL em data/events/events.jsonl. Pluggavel: setEventSink() permite
// trocar por um sink que envia ao CRM (POST /api/agent/events) na fase durável.
// Nao registra PII: telefone entra pseudonimizado (phoneHash).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.EVENTS_DIR || path.resolve(__dirname, '..', '..', 'data', 'events');
const FILE = path.join(DIR, 'events.jsonl');

function fileSink(event) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(event) + '\n');
  } catch (e) {
    console.error('[telemetry] erro ao gravar', e.message);
  }
}

let sink = fileSink;

/** Troca o destino dos eventos (ex.: enviar ao CRM). */
export function setEventSink(fn) {
  sink = typeof fn === 'function' ? fn : fileSink;
}

/**
 * Emite um evento estruturado.
 * @param {object} e { conversationId?, phoneHash?, agent, type, kpi?, value?, meta? }
 */
export function emit(e = {}) {
  const event = {
    ts: new Date().toISOString(),
    conversationId: e.conversationId || null,
    phoneHash: e.phoneHash || null,
    agent: e.agent || 'desconhecido',
    type: e.type || 'evento',
    kpi: e.kpi || null,
    value: e.value ?? null,
    meta: e.meta || {},
  };
  sink(event);
  return event;
}

/** Le todos os eventos do sink de arquivo (para agregacao/KPIs). */
export function lerEventos(file = FILE) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const _EVENTS_FILE = FILE;
