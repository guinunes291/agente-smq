// Log de decisao dos agentes (auditavel). Uma linha JSONL por turno.
// Nao registra conteudo da mensagem do cliente (privacidade); so metadados de decisao.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, '..', '..', 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'decisions.jsonl');

/**
 * @param {object} entry { phone, agentsRun, objecaoDetectada, faixaMcmv,
 *                          complianceViolations, estagio, temperatura, handoff }
 */
export function logDecision(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    console.error('[decisionLog] erro ao gravar', e.message);
  }
  return line;
}

export const _LOG_FILE = LOG_FILE;
