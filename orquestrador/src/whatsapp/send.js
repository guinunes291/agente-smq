// Roteia o envio para o canal certo (com retry em falhas transientes).
import { config } from '../config.js';
import * as meta from './meta.js';
import * as zapi from './zapi.js';
import { withRetry } from '../lib/retry.js';

// channel: 'meta' | 'zapi' | undefined (usa REPLY_CHANNEL)
export async function sendText(to, body, channel) {
  const ch = (channel || config.replyChannel || 'meta').toLowerCase();
  try {
    return await withRetry(() => (ch === 'zapi' ? zapi.sendText(to, body) : meta.sendText(to, body)), {
      rotulo: `send:${ch}`,
      tentativas: 3,
      baseMs: 800,
    });
  } catch (e) {
    const detail = e.response?.data || e.message;
    console.error(`[send:${ch}] falha ao enviar para ${to}:`, JSON.stringify(detail));
    throw e;
  }
}

export async function sendTemplate(to, name, params, lang) {
  return withRetry(() => meta.sendTemplate(to, name, params, lang), { rotulo: 'send:template', tentativas: 3, baseMs: 800 });
}
