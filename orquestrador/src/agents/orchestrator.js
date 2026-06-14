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
import { emit } from '../telemetry/events.js';
import { pseudonimo } from '../lib/normalize.js';

/**
 * Processa um turno completo de conversa.
 * @param {Object} lead   estado do lead (state.js)
 * @param {Object} inbound { text, ... } mensagem recebida
 * @returns {Promise<import('./contracts.js').Decision>}
 */
export async function orchestrate(lead, inbound = {}) {
  const t0 = Date.now();
  const knowledge = loadKnowledge();
  const memory = memoryRepo.get(lead.phone);
  const phoneHash = pseudonimo(lead.phone);
  const conversationId = lead.crmLeadId ? `crm:${lead.crmLeadId}` : phoneHash;
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

  // 7) Telemetria por agente (KPIs) — pseudonimizada, sem PII nem texto do cliente
  const latencia = Date.now() - t0;
  emit({ conversationId, phoneHash, agent: 'orchestrator', type: 'turno', kpi: 'latencia_ms', value: latencia });
  emit({ conversationId, phoneHash, agent: 'credito', type: 'analise', meta: { faixa: credito.data?.faixa || null } });
  if (objecoes.data?.principal)
    emit({ conversationId, phoneHash, agent: 'objecoes', type: 'deteccao', meta: { objecao: objecoes.data.principal } });
  emit({
    conversationId, phoneHash, agent: 'produto', type: 'match',
    kpi: 'taxa_aderencia', value: produto.data?.empreendimentos?.length ? 1 : 0,
  });
  emit({
    conversationId, phoneHash, agent: 'compliance', type: 'revisao',
    kpi: 'pct_bloqueadas', value: compliance.approved ? 0 : 1,
    meta: { violations: compliance.violations.map((v) => v.rule) },
  });
  emit({
    conversationId, phoneHash, agent: 'qualificador', type: 'resposta',
    meta: { estagio: decision.estagio, temperatura: decision.temperatura, handoff: !!decision.handoff },
  });

  // 8) Log de decisao (auditavel, telefone pseudonimizado — LGPD)
  logDecision({
    phoneHash,
    conversationId,
    agentsRun: ['credito', 'objecoes', 'produto', 'followup', 'qualificador', 'compliance'],
    objecaoDetectada: objecoes.data?.principal || null,
    faixaMcmv: credito.data?.faixa || null,
    complianceViolations: compliance.violations.map((v) => v.rule),
    estagio: decision.estagio,
    temperatura: decision.temperatura,
    handoff: !!decision.handoff,
    bloqueada: !compliance.approved,
    latenciaMs: latencia,
  });

  return decision;
}
