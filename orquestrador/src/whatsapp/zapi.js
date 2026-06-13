// Canal secundario - Z-API (janela conversacional)
import axios from 'axios';
import { config } from '../config.js';

const base = () => `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.instanceToken}`;
const headers = () => ({ 'Client-Token': config.zapi.clientToken, 'Content-Type': 'application/json' });

export async function sendText(to, body) {
  const { data } = await axios.post(`${base()}/send-text`, { phone: to, message: body }, { headers: headers() });
  return data;
}

// Normaliza o payload de webhook da Z-API
export function parseInbound(reqBody) {
  if (!reqBody || reqBody.fromMe) return []; // ignora as proprias mensagens
  const text = reqBody.text?.message || reqBody.message || '';
  if (!reqBody.phone || !text) return [];
  return [{
    channel: 'zapi',
    from: reqBody.phone,
    name: reqBody.senderName || reqBody.chatName || null,
    text,
    ts: reqBody.momment || Date.now(),
  }];
}
