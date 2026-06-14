// Ferramentas (acoes) que o agente pode acionar. O index.js executa cada acao do JSON do agente.
import { config } from './config.js';
import { buscarEmpreendimentos, buscarCorretor, buscarCorretores, loadKnowledge } from './knowledge.js';
import { saveLead, nextRotationIndex } from './state.js';
import { upsertLeadCRM } from './crm.js';
import { pushLeadToCRM, crmEnabled } from './crm-integration.js';
import { sendText } from './whatsapp/send.js';

// Roleta LOCAL (fallback quando o CRM nao esta configurado/respondeu).
function selecionarCorretorLocal(lead, { empreendimentoId }) {
  const cands = buscarCorretores({ empreendimentoId, regiao: lead.regiao });
  if (cands.length) {
    const groupKey = empreendimentoId || lead.regiao || 'global';
    const idx = nextRotationIndex(`corretor:${groupKey}`, cands.length);
    const c = cands[idx];
    return { nome: c.nome, telefone: c.telefone, id: c.id, fonte: 'roleta_local' };
  }
  return { nome: 'Plantonista SMQ', telefone: config.handoff.fallbackCorretorPhone, id: '', fonte: 'fallback' };
}

// Mescla campos coletados pelo agente no objeto do lead
export function salvarLead(lead, campos = {}) {
  const map = ['nome', 'origem', 'objetivo', 'faixaRenda', 'regiao', 'empreendimentoInteresse', 'temperatura', 'estagio'];
  for (const k of map) if (campos[k] !== undefined && campos[k] !== null && campos[k] !== '') lead[k] = campos[k];
  saveLead(lead);
  upsertLeadCRM(lead, { resumo: campos.resumo || '' });
  return { ok: true };
}

export function agendar(lead, { empreendimento, data, hora } = {}) {
  lead.estagio = 'agendado';
  lead.agendamento = { empreendimento, data, hora, criadoEm: Date.now() };
  saveLead(lead);
  // Aqui voce integraria com Google Calendar/agenda do corretor.
  console.log(`[AGENDAR] ${lead.phone} -> ${empreendimento} em ${data} ${hora}`);
  return { ok: true };
}

// HANDOFF: passa o lead qualificado para o corretor e ENCERRA a conducao do agente.
// Caminho 1 (preferido): CRM proprio faz a roleta + notifica o corretor.
// Caminho 2 (fallback): roleta local + notifica o corretor pela Z-API/Meta.
export async function handoff(lead, { resumo = '', motivo = 'analise', empreendimentoId } = {}) {
  const empId = empreendimentoId || lead.empreendimentoIdInteresse;
  lead.handoff = true;
  lead.estagio = 'handoff';

  // --- Caminho 1: CRM ---
  if (crmEnabled()) {
    const crm = await pushLeadToCRM(lead, { resumo });
    if (crm?.ok) {
      lead.corretorDestino = `CRM:corretorId=${crm.corretorId}`;
      lead.crm = { leadId: crm.leadId, corretorId: crm.corretorId, distribuido: crm.distribuido };
      saveLead(lead);
      upsertLeadCRM(lead, { corretorDestino: lead.corretorDestino, resumo });
      console.log(`[HANDOFF] CRM ok: leadId=${crm.leadId} corretorId=${crm.corretorId} distribuido=${crm.distribuido}`);
      // O CRM ja notifica o corretor — o agente nao envia card.
      return { ok: true, via: 'crm', leadId: crm.leadId, corretorId: crm.corretorId, distribuido: crm.distribuido };
    }
    console.warn('[HANDOFF] CRM falhou, caindo para roleta local.');
  }

  // --- Caminho 2: roleta local + notificacao direta ---
  const corretor = selecionarCorretorLocal(lead, { empreendimentoId: empId });
  const corretorTel = corretor.telefone || config.handoff.fallbackCorretorPhone;
  lead.corretorDestino = corretor.nome;
  saveLead(lead);
  upsertLeadCRM(lead, { corretorDestino: corretor.nome, resumo });
  console.log(`[HANDOFF] corretor via ${corretor.fonte}: ${corretor.nome} (${corretor.id || '-'})`);

  // Sugere ao corretor o proximo agente de campo conforme o motivo do handoff (patch aditivo).
  const proximoAgente = ({
    analise: 'conferente-documentacao-mcmv -> preparador-de-visita',
    visita: 'preparador-de-visita + curador-de-imoveis',
    fechar: 'gerador-documentos-imobiliarios',
    captacao: 'analista-cma-precificacao',
  })[motivo] || 'preparador-de-visita';

  const card =
    `LEAD QUALIFICADO - assumir\n` +
    `Nome: ${lead.nome || '-'} | Tel: ${lead.phone}\n` +
    `Origem: ${lead.origem || '-'}\n` +
    `Objetivo: ${lead.objetivo || '-'} | Renda: ${lead.faixaRenda || '-'}\n` +
    `Regiao: ${lead.regiao || '-'} | Interesse: ${lead.empreendimentoInteresse || '-'}\n` +
    `Temperatura: ${lead.temperatura} | Motivo: ${motivo}\n` +
    `Resumo: ${resumo}\n` +
    `Proximo agente: ${proximoAgente}\n` +
    `Abrir: https://wa.me/${lead.phone}`;

  if (config.handoff.notifyChannel !== 'log' && corretorTel) {
    try {
      await sendText(corretorTel, card, config.handoff.notifyChannel);
    } catch (e) {
      console.error('[HANDOFF] falha ao notificar corretor:', e.message);
    }
  }
  console.log('[HANDOFF]\n' + card);
  return { ok: true, via: corretor.fonte, corretor: corretor.nome, corretorTel };
}

export function optOut(lead) {
  lead.optOut = true;
  lead.estagio = 'encerrado';
  saveLead(lead);
  upsertLeadCRM(lead, { resumo: 'OPT-OUT solicitado pelo cliente' });
  return { ok: true };
}

// Exposto ao agente como "ferramentas de leitura" (injetadas no contexto)
export function contextoConhecimento(lead) {
  const emp = buscarEmpreendimentos({ regiao: lead.regiao, objetivo: lead.objetivo });
  const corretor = buscarCorretor({ regiao: lead.regiao });
  const { regrasMcmv } = loadKnowledge();
  return { empreendimentos: emp, corretorSugerido: corretor, regrasMcmvResumo: regrasMcmv.slice(0, 1200) };
}

// Dispatcher usado pelo index.js para executar as acoes que o agente pediu
export async function executarAcao(lead, acao) {
  const { tool, args = {} } = acao;
  switch (tool) {
    case 'SALVAR_LEAD': return salvarLead(lead, args);
    case 'AGENDAR': return agendar(lead, args);
    case 'HANDOFF': return handoff(lead, args);
    case 'OPT_OUT': return optOut(lead);
    default:
      console.warn('[tools] acao desconhecida:', tool);
      return { ok: false };
  }
}
