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

  // IGNORAR GRUPOS (nunca responder grupo)
  const isGroup =
    reqBody.isGroup === true ||
    reqBody.isgroup === true ||
    Boolean(reqBody.participantPhone) ||
    (typeof reqBody.phone === 'string' && (reqBody.phone.includes('-group') || reqBody.phone.endsWith('@g.us')));
  if (isGroup) return [];

  // Ignorar status/broadcast
  if (reqBody.broadcast === true) return [];
  if (!reqBody.phone) return [];

  const text = reqBody.text?.message || reqBody.message || '';
  // Detecta midia (audio/imagem/video/documento) quando nao ha texto.
  let mediaType = null;
  if (!text) {
    if (reqBody.audio) mediaType = 'audio';
    else if (reqBody.image) mediaType = 'image';
    else if (reqBody.video) mediaType = 'video';
    else if (reqBody.document) mediaType = 'document';
    else return []; // evento sem texto nem midia conhecida -> ignora
  }

  return [{
    channel: 'zapi',
    id: reqBody.messageId || reqBody.id || null,
    from: reqBody.phone,
    name: reqBody.senderName || reqBody.chatName || null,
    text,
    mediaType,
    ts: reqBody.momment || Date.now(),
    isGroup: false,
  }];
}
