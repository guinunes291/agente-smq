// Roteia o envio para o canal certo.
import { config } from '../config.js';
import * as meta from './meta.js';
import * as zapi from './zapi.js';

// channel: 'meta' | 'zapi' | undefined (usa REPLY_CHANNEL)
export async function sendText(to, body, channel) {
  const ch = (channel || config.replyChannel || 'meta').toLowerCase();
  try {
    if (ch === 'zapi') return await zapi.sendText(to, body);
    return await meta.sendText(to, body);
  } catch (e) {
    const detail = e.response?.data || e.message;
    console.error(`[send:${ch}] falha ao enviar para ${to}:`, JSON.stringify(detail));
    throw e;
  }
}

export async function sendTemplate(to, name, params, lang) {
  return meta.sendTemplate(to, name, params, lang);
}
