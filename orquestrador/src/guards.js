// Travas anti-spam / compliance.
import { config } from './config.js';
import { countSentLast24h } from './state.js';

const OPTOUT_WORDS = ['sair', 'parar', 'stop', 'descadastrar', 'nao quero', 'não quero', 'cancelar'];

export function isOptOutMessage(text = '') {
  const t = text.trim().toLowerCase();
  return OPTOUT_WORDS.some((w) => t === w || t.includes(w));
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
