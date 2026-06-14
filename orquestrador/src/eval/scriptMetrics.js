// Avaliacao de performance de scripts.
// Registra qual variante de mensagem foi usada e o desfecho, em JSONL, e agrega
// taxa de resposta / handoff por variante. Insumo do Agente Otimizador (fase Estavel).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.METRICS_DIR || path.resolve(__dirname, '..', '..', 'data', 'metrics');
const FILE = path.join(DATA_DIR, 'scripts.jsonl');

// Hash curto da variante (agrupa scripts identicos sem guardar PII).
export function varianteId(texto) {
  return crypto.createHash('sha1').update((texto || '').trim()).digest('hex').slice(0, 10);
}

/**
 * Registra um evento de uso de script.
 * @param {object} ev { tipo:'primeiro_contato'|'followup'|..., variante, estagio, evento:'enviado'|'respondido'|'handoff', phone }
 */
export function registrarScript(ev = {}) {
  const rec = {
    ts: new Date().toISOString(),
    tipo: ev.tipo || 'desconhecido',
    varianteId: ev.varianteId || varianteId(ev.variante || ''),
    estagio: ev.estagio || null,
    evento: ev.evento || 'enviado',
    phone: ev.phone || null,
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('[scriptMetrics] erro ao gravar', e.message);
  }
  return rec;
}

// Agrega taxa de resposta/handoff por variante a partir do JSONL.
export function agregarPorVariante(file = FILE) {
  let linhas = [];
  try {
    linhas = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return {};
  }
  const acc = {};
  for (const l of linhas) {
    let r;
    try {
      r = JSON.parse(l);
    } catch {
      continue;
    }
    const k = r.varianteId;
    acc[k] = acc[k] || { tipo: r.tipo, enviados: 0, respondidos: 0, handoffs: 0 };
    if (r.evento === 'enviado') acc[k].enviados += 1;
    if (r.evento === 'respondido') acc[k].respondidos += 1;
    if (r.evento === 'handoff') acc[k].handoffs += 1;
  }
  for (const k of Object.keys(acc)) {
    const a = acc[k];
    a.taxaResposta = a.enviados ? +(a.respondidos / a.enviados).toFixed(3) : 0;
    a.taxaHandoff = a.enviados ? +(a.handoffs / a.enviados).toFixed(3) : 0;
  }
  return acc;
}

export const _FILE = FILE;
