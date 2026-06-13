// Ferramentas (acoes) que o agente pode acionar. O index.js executa cada acao do JSON do agente.
import { config } from './config.js';
import { buscarEmpreendimentos, buscarCorretor, loadKnowledge } from './knowledge.js';
import { saveLead } from './state.js';
import { upsertLeadCRM } from './crm.js';
import { sendText } from './whatsapp/send.js';

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

// HANDOFF: notifica o corretor responsavel e ENCERRA a conducao do agente.
export async function handoff(lead, { resumo = '', motivo = 'analise', empreendimentoId } = {}) {
  const corretor = buscarCorretor({ empreendimentoId: empreendimentoId || lead.empreendimentoIdInteresse, regiao: lead.regiao });
  const corretorNome = corretor?.nome || 'Plantonista SMQ';
  const corretorTel = corretor?.telefone || config.handoff.fallbackCorretorPhone;

  lead.handoff = true;
  lead.estagio = 'handoff';
  lead.corretorDestino = corretorNome;
  saveLead(lead);
  upsertLeadCRM(lead, { corretorDestino: corretorNome, resumo });

  const card =
    `LEAD QUALIFICADO - assumir\n` +
    `Nome: ${lead.nome || '-'} | Tel: ${lead.phone}\n` +
    `Origem: ${lead.origem || '-'}\n` +
    `Objetivo: ${lead.objetivo || '-'} | Renda: ${lead.faixaRenda || '-'}\n` +
    `Regiao: ${lead.regiao || '-'} | Interesse: ${lead.empreendimentoInteresse || '-'}\n` +
    `Temperatura: ${lead.temperatura} | Motivo: ${motivo}\n` +
    `Resumo: ${resumo}\n` +
    `Abrir: https://wa.me/${lead.phone}`;

  if (config.handoff.notifyChannel !== 'log' && corretorTel) {
    try {
      await sendText(corretorTel, card, config.handoff.notifyChannel);
    } catch (e) {
      console.error('[HANDOFF] falha ao notificar corretor:', e.message);
    }
  }
  console.log('[HANDOFF]\n' + card);
  return { ok: true, corretor: corretorNome, corretorTel };
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
