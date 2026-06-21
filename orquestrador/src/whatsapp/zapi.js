// Canal secundario - Z-API (janela conversacional)
import axios from 'axios';
import { config } from '../config.js';

const base = () => `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.instanceToken}`;
const headers = () => ({ 'Client-Token': config.zapi.clientToken, 'Content-Type': 'application/json' });

// Z-API espera so digitos (sem +, espacos ou mascara)
function normalizaTelefone(p) {
  return String(p || '').replace(/\D/g, '');
}

export async function sendText(to, body) {
  const phone = normalizaTelefone(to);
  const { data } = await axios.post(`${base()}/send-text`, { phone, message: body }, { headers: headers() });
  return data;
}

// Normaliza o payload de webhook da Z-API
export function parseInbound(reqBody) {
  if (!reqBody || reqBody.fromMe) return []; // ignora as proprias mensagens

  // IGNORAR GRUPOS (nunca responder grupo)
  const isGroup =
    reqBody.isGroup === true ||
    reqBody.isgroup === true ||
    Boolean(reqBody.participantPhone) ||
    (typeof reqBody.phone === 'string' && (reqBody.phone.includes('-group') || reqBody.phone.endsWith('@g.us')));
  if (isGroup) return [];

  // Ignorar status/broadcast e eventos sem texto
  if (reqBody.broadcast === true) return [];
  const text = reqBody.text?.message || reqBody.message || '';
  if (!reqBody.phone || !text) return [];

  return [{
    channel: 'zapi',
    from: reqBody.phone,
    name: reqBody.senderName || reqBody.chatName || null,
    text,
    ts: reqBody.momment || Date.now(),
    isGroup: false,
  }];
}
