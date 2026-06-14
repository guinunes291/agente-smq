// Agente Orquestrador.
// Decide quem atua, coordena a troca de contexto entre os especialistas, chama o
// Qualificador (LLM), passa pela Auditoria/Compliance, persiste memoria util e
// registra o log de decisao. Devolve um Decision com o MESMO shape de runAgent,
// para integracao minima no processor.js.
import { loadKnowledge } from '../knowledge.js';
import { config } from '../config.js';
import { analisarCredito } from './credito.js';
import { detectarObjecao } from './objecoes.js';
import { sugerirProduto } from './produto.js';
import { planejarFollowup } from './followup.js';
import { runQualificador } from './qualificador.js';
import { revisarMensagem } from './compliance.js';
import { extrairAprendizados } from './memoria.js';
import { memoryRepo } from '../memory/repository.js';
import { logDecision } from '../logs/decisionLog.js';

/**
 * Processa um turno completo de conversa.
 * @param {Object} lead   estado do lead (state.js)
 * @param {Object} inbound { text, ... } mensagem recebida
 * @returns {Promise<import('./contracts.js').Decision>}
 */
export async function orchestrate(lead, inbound = {}) {
  const knowledge = loadKnowledge();
  const memory = memoryRepo.get(lead.phone);
  const now = new Date(Date.now() + config.ops.tzOffset * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);

  // 1) Contexto compartilhado
  const ctx = { lead, knowledge, memory, inboundText: inbound.text || '', now, nowTs: Date.now() };

  // 2) Especialistas deterministicos (roteamento: rodam sempre, mas so injetam o que e relevante)
  const credito = analisarCredito(ctx);
  ctx.credito = credito.data;
  const objecoes = detectarObjecao(ctx);
  const produto = sugerirProduto(ctx);
  const followup = planejarFollowup(ctx);

  const especialistas = [credito, objecoes, produto];
  const extraContext = especialistas
    .map((e) => e.contextForPrompt)
    .filter(Boolean)
    .join('\n\n');

  // 3) Qualificador (unica chamada LLM)
  const decision = await runQualificador(lead, extraContext);

  // 4) Auditoria / Compliance sobre a mensagem
  const compliance = revisarMensagem(decision.mensagem_cliente, lead);
  if (!compliance.approved) {
    decision.mensagem_cliente = null; // bloqueia envio (processor trata null sem reenviar)
  } else if (compliance.revisedMessage) {
    decision.mensagem_cliente = compliance.revisedMessage;
  }
  decision.complianceViolations = compliance.violations;

  // 5) Memoria comercial (aprendizados curados)
  try {
    const aprendizados = extrairAprendizados({ lead, decision, objecoes, credito, produto });
    if (aprendizados) memoryRepo.merge(lead.phone, aprendizados);
  } catch (e) {
    console.error('[orchestrator] memoria falhou:', e.message);
  }

  // 6) Follow-up: registra proxima acao no lead (consumido por jobs)
  lead.proximaAcao = followup.data;

  // 7) Log de decisao (auditavel, sem o texto do cliente)
  logDecision({
    phone: lead.phone,
    agentsRun: ['credito', 'objecoes', 'produto', 'followup', 'qualificador', 'compliance'],
    objecaoDetectada: objecoes.data?.principal || null,
    faixaMcmv: credito.data?.faixa || null,
    complianceViolations: compliance.violations.map((v) => v.rule),
    estagio: decision.estagio,
    temperatura: decision.temperatura,
    handoff: !!decision.handoff,
    bloqueada: !compliance.approved,
  });

  return decision;
}
