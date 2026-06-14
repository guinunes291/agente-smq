// Travas anti-spam / compliance.
import { config } from './config.js';
import { countSentLast24h } from './state.js';
import { canonical, numPalavras } from './lib/normalize.js';

// Palavras/expressoes que, SOZINHAS ou em mensagem curta, indicam opt-out real.
const OPTOUT_EXATO = ['sair', 'parar', 'stop', 'pare', 'descadastrar', 'cancelar', 'remover', 'sai'];
// Frases inequivocas de descadastro (valem mesmo em mensagem longa).
const OPTOUT_FRASES = [
  'nao quero receber',
  'parar de receber',
  'nao me mande',
  'nao me envie',
  'me descadastr',
  'me remov',
  'sair da lista',
  'cancelar inscricao',
  'nao quero mais receber',
];

// Contextos que NEGAM o opt-out (parar/sair com outro sentido) — evita falso positivo.
const FALSO_POSITIVO = /\b(parar de pagar|sair do aluguel|parar com o aluguel|sair da casa|sair de casa)\b/;

/**
 * Opt-out so dispara quando ha intencao real de descadastro:
 *  - mensagem curta (<=3 palavras) contendo uma palavra-chave exata, OU
 *  - uma frase inequivoca de descadastro.
 * "vou parar de pagar aluguel" / "quero sair do aluguel" NAO sao opt-out.
 */
export function isOptOutMessage(text = '') {
  const c = canonical(text);
  if (!c) return false;
  if (FALSO_POSITIVO.test(c)) return false;
  if (OPTOUT_FRASES.some((f) => c.includes(f))) return true;
  if (numPalavras(c) <= 3) {
    const tokens = c.split(' ');
    return tokens.some((tk) => OPTOUT_EXATO.includes(tk));
  }
  return false;
}

// Horario comercial (apenas para mensagens de INICIATIVA do agente; respostas em janela 24h sao sempre permitidas)
export function isBusinessHours(now = new Date()) {
  const local = new Date(now.getTime() + config.ops.tzOffset * 3600 * 1000);
  const h = local.getUTCHours();
  const day = local.getUTCDay(); // 0=dom
  if (day === 0) return false; // domingo
  if (day === 6 && h >= 14) return false; // sabado ate 14h
  return h >= config.ops.hoursStart && h < config.ops.hoursEnd;
}

export function rateLimitOk(lead) {
  return countSentLast24h(lead) < config.ops.maxPerLeadPerDay;
}

// Atraso humano aleatorio entre mensagens
export function humanDelay() {
  const { minDelayMs, maxDelayMs } = config.ops;
  return Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
