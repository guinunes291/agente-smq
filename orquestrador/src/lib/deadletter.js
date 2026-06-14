// Dead-letter: registra turnos que falharam em ser entregues (apos retries),
// para reprocessamento posterior. Sem isso, uma falha de envio = lead em silencio.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pseudonimo } from './normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.DEADLETTER_DIR || path.resolve(__dirname, '..', '..', 'data', 'deadletter');
const FILE = path.join(DIR, 'failed.jsonl');

/**
 * Registra uma falha de turno. NAO grava o telefone cru (LGPD): so phoneHash e
 * o texto inbound (necessario para reprocessar).
 */
export function registrarFalha({ inbound = {}, fase = 'envio', erro = '' } = {}) {
  const rec = {
    ts: new Date().toISOString(),
    fase, // 'llm' | 'envio'
    erro: String(erro).slice(0, 300),
    channel: inbound.channel || null,
    phoneHash: inbound.from ? pseudonimo(inbound.from) : null,
    phone: inbound.from || null, // necessario para reenviar; expurgar via retencao
    text: inbound.text || '',
    msgId: inbound.id || null,
  };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('[deadletter] erro ao gravar', e.message);
  }
  return rec;
}

export function listarFalhas(file = FILE) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export const _FILE = FILE;
