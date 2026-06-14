// Canal oficial - Meta WhatsApp Cloud API
import axios from 'axios';
import { config } from '../config.js';

const base = () => `https://graph.facebook.com/${config.meta.graphVersion}/${config.meta.phoneNumberId}/messages`;
const headers = () => ({ Authorization: `Bearer ${config.meta.accessToken}`, 'Content-Type': 'application/json' });

// Texto livre (so dentro da janela de 24h)
export async function sendText(to, body) {
  const payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
  const { data } = await axios.post(base(), payload, { headers: headers() });
  return data;
}

// Template aprovado (HSM) - usado fora da janela / primeiro contato frio
export async function sendTemplate(to, templateName, params = [], lang = 'pt_BR') {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      components: params.length ? [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t) })) }] : [],
    },
  };
  const { data } = await axios.post(base(), payload, { headers: headers() });
  return data;
}

// Normaliza o payload de webhook da Meta para o formato interno
export function parseInbound(reqBody) {
  const out = [];
  for (const entry of reqBody.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contacts = value.contacts || [];
      for (const msg of value.messages || []) {
        if (msg.type !== 'text') continue; // mvp: so texto
        out.push({
          channel: 'meta',
          id: msg.id || null,
          from: msg.from,
          name: contacts[0]?.profile?.name || null,
          text: msg.text?.body || '',
          ts: Number(msg.timestamp) * 1000 || Date.now(),
        });
      }
    }
  }
  return out;
}
