// Integracao com o CRM proprio da SMQ (hospedado em seumetroquadrado.click).
// O CRM faz a ROLETA e atribui o corretor automaticamente, e ja notifica o corretor.
// O agente apenas envia o lead qualificado e recebe { corretorId, distribuido }.
//
// Endpoint:  POST {BASE}/api/webhook/facebook/{TOKEN}        (roleta normal)
//            POST {BASE}/api/webhook/facebook-foco/{TOKEN}    (fila Foco, sem limite diario)
// Auth:      token vai na URL (sem header Bearer).
// Body:      { nome, telefone, email, faixaRenda, finalidadeImovel, prefereContatoPor, projectId }
// Resposta:  { success, leadId, corretorId, distribuido, message }
import axios from 'axios';
import { config } from './config.js';

function mapFinalidade(objetivo = '') {
  const o = objetivo.toLowerCase();
  if (/invest/.test(o)) return 'investimento';
  if (/mor/.test(o)) return 'moradia';
  return objetivo || '';
}

// telefone no formato que o CRM espera (ex.: 11999999999) - remove DDI 55 se presente
function normalizaTelefone(phone = '') {
  let p = String(phone).replace(/\D/g, '');
  if (p.length >= 12 && p.startsWith('55')) p = p.slice(2);
  return p;
}

export function crmEnabled() {
  return Boolean(config.crm.token);
}

export async function pushLeadToCRM(lead, { resumo = '' } = {}) {
  if (!crmEnabled()) return null; // CRM nao configurado -> caller usa roleta local
  const queue = config.crm.queue === 'foco' ? 'facebook-foco' : 'facebook';
  const url = `${config.crm.baseUrl}/api/webhook/${queue}/${config.crm.token}`;
  const payload = {
    nome: lead.nome || undefined,
    telefone: normalizaTelefone(lead.phone),
    email: lead.email || undefined,
    faixaRenda: lead.faixaRenda || undefined,
    finalidadeImovel: mapFinalidade(lead.objetivo),
    prefereContatoPor: 'WhatsApp',
    projectId: lead.projectId || undefined, // id numerico do projeto no CRM, se conhecido
  };
  try {
    const { data } = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 8000,
    });
    if (data?.success) {
      return { ok: true, leadId: data.leadId, corretorId: data.corretorId, distribuido: !!data.distribuido, raw: data };
    }
    console.error('[CRM] resposta sem success:', JSON.stringify(data));
    return { ok: false, raw: data };
  } catch (e) {
    console.error('[CRM] falha no POST:', e.response?.status, JSON.stringify(e.response?.data || e.message));
    return { ok: false, error: e.response?.data || e.message };
  }
}
