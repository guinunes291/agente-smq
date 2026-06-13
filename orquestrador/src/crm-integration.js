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

// Consulta se um telefone JA E um lead cadastrado (forms/CRM).
// Usado na ENTRADA: se o lead se cadastrou no forms e mandar mensagem, deve ser respondido.
// Requer a rota CRM_LOOKUP_PATH exposta pelo CRM (ex.: GET /api/leads/lookup?telefone=..&token=..).
// Retorna { id, nome, telefone, ... } se encontrado; null caso contrario.
export async function buscarLeadCadastrado(phone) {
  if (!config.crm.token || !config.crm.lookupPath) return null;
  const telefone = normalizaTelefone(phone);
  const url = `${config.crm.baseUrl}${config.crm.lookupPath}`;
  try {
    const { data } = await axios.get(url, {
      params: { telefone, token: config.crm.token },
      timeout: 6000,
    });
    if (!data) return null;
    if (data.found === false) return null;
    return data.lead || (data.found ? data : null) || (data.id ? data : null);
  } catch (e) {
    console.error('[CRM] lookup por telefone falhou:', e.response?.status, e.message);
    return null; // em duvida, NAO responde (seguro contra spam)
  }
}

export async function pushLeadToCRM(lead, { resumo = '' } = {}) {
  if (!crmEnabled()) return null; // CRM nao configurado -> caller usa roleta local
  // Caminho A: o agente cria o lead UMA vez, no handoff (apos qualificar).
  // Endpoint generico /lead aceita os campos de qualificacao; a roleta (Foco/Geral)
  // e decidida pelo CRM conforme o projeto. CRM_QUEUE=foco forca a fila Foco.
  const path = config.crm.queue === 'foco'
    ? `api/webhook/facebook-foco/${config.crm.token}`
    : `api/webhook/lead/${config.crm.token}`;
  const url = `${config.crm.baseUrl}/${path}`;
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
