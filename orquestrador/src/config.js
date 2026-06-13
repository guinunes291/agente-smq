import dotenv from 'dotenv';
dotenv.config();

const num = (v, d) => (v !== undefined && v !== '' ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3000),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  },

  meta: {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
    verifyToken: process.env.META_VERIFY_TOKEN || 'smq-verify',
    graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
  },

  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID,
    instanceToken: process.env.ZAPI_INSTANCE_TOKEN,
    clientToken: process.env.ZAPI_CLIENT_TOKEN,
  },

  replyChannel: (process.env.REPLY_CHANNEL || 'meta').toLowerCase(),

  ops: {
    hoursStart: num(process.env.BUSINESS_HOURS_START, 9),
    hoursEnd: num(process.env.BUSINESS_HOURS_END, 20),
    tzOffset: num(process.env.TIMEZONE_OFFSET, -3),
    maxPerLeadPerDay: num(process.env.MAX_MESSAGES_PER_LEAD_PER_DAY, 8),
    minDelayMs: num(process.env.MIN_DELAY_MS, 3000),
    maxDelayMs: num(process.env.MAX_DELAY_MS, 12000),
  },

  handoff: {
    notifyChannel: (process.env.HANDOFF_NOTIFY_CHANNEL || 'log').toLowerCase(),
    fallbackCorretorPhone: process.env.FALLBACK_CORRETOR_PHONE || '',
  },

  // CRM proprio (seumetroquadrado.click): faz a roleta e notifica o corretor.
  // Se CRM_TOKEN vazio, usa roleta LOCAL (corretores.csv).
  crm: {
    baseUrl: process.env.CRM_BASE_URL || 'https://seumetroquadrado.click',
    token: process.env.CRM_TOKEN || '',        // token da campanha (vai na URL)
    queue: (process.env.CRM_QUEUE || 'normal').toLowerCase(), // "normal" | "foco"
  },
};

export function assertConfig() {
  const missing = [];
  if (!config.anthropic.apiKey) missing.push('ANTHROPIC_API_KEY');
  if (config.replyChannel === 'meta' && !config.meta.accessToken) missing.push('META_ACCESS_TOKEN');
  if (missing.length) {
    console.warn('[config] Variaveis ausentes:', missing.join(', '), '- rode com .env preenchido.');
  }
}
