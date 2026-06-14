// Agente de Follow-up Inteligente.
// Calcula a PROXIMA ACAO conforme o comportamento/estado do lead. Deterministico
// (sem custo de API). O texto final, quando preciso gerar, fica a cargo do
// Qualificador; aqui definimos QUANDO e COM QUE INTENCAO falar de novo.
// Base: 05-OPERACAO/cadencia-follow-up.md
import { emptyResult } from './contracts.js';

const HORA = 3600 * 1000;
const DIA = 24 * HORA;

// Cadencia por temperatura (em dias a partir do ultimo contato), respeitando anti-spam.
const CADENCIA = {
  PRONTO: { intencao: 'handoff_em_andamento', proximaEmDias: 0 },
  QUENTE: { intencao: 'empurrar_analise_ou_visita', proximaEmDias: 1 },
  MORNO: { intencao: 'educar_valor', proximaEmDias: 3 },
  FRIO: { intencao: 'reativar_com_novidade', proximaEmDias: 7 },
};

/**
 * @param {import('./contracts.js').AgentContext} ctx
 * @returns {import('./contracts.js').AgentResult}
 */
export function planejarFollowup(ctx) {
  const r = emptyResult('followup');
  const lead = ctx?.lead || {};
  const agora = ctx?.nowTs || Date.now();

  // Comportamento observado
  const sumiu = lead.lastInboundTs && agora - lead.lastInboundTs > 2 * DIA;
  const noShow = lead.agendamento && lead.estagio === 'agendado' && false; // sinal real vem do CRM (fase Estavel)

  let comportamento = 'respondendo';
  if (lead.handoff) comportamento = 'em_handoff';
  else if (noShow) comportamento = 'nao_compareceu';
  else if (sumiu) comportamento = 'sumiu';

  const plano = CADENCIA[lead.temperatura] || CADENCIA.MORNO;
  const baseTs = lead.lastInboundTs || agora;
  const proximaAcaoTs = baseTs + plano.proximaEmDias * DIA;

  r.data = {
    comportamento,
    intencao: plano.intencao,
    proximaAcaoTs,
    proximaAcaoEmDias: plano.proximaEmDias,
  };
  r.summary = `Follow-up: ${comportamento} -> ${plano.intencao} (~D+${plano.proximaEmDias}).`;
  if (comportamento === 'sumiu') {
    r.contextForPrompt =
      'FOLLOW-UP: cliente sumiu (>2 dias). Faca uma reabordagem leve com 1 novidade/valor; sem cobrar, sem insistir.';
  }
  return r;
}
