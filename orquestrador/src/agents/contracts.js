// Contratos de comunicacao entre os agentes (Zod + JSDoc).
// Saida do orquestrador (Decision) e IDENTICA ao retorno atual de runAgent,
// para que o processor.js mude apenas a chamada (orchestrate em vez de runAgent).
import { z } from 'zod';

// ---- Enums compartilhados ----
export const TemperaturaEnum = z.enum(['FRIO', 'MORNO', 'QUENTE', 'PRONTO']);
export const EstagioEnum = z.enum([
  'primeiro_contato',
  'qualificando',
  'oferta_visita',
  'oferta_analise',
  'agendado',
  'handoff',
  'encerrado',
]);

// ---- Acao que o agente pede ao executar tools (SALVAR_LEAD, AGENDAR, HANDOFF, OPT_OUT) ----
export const AcaoSchema = z.object({
  tool: z.string(),
  args: z.record(z.any()).optional().default({}),
});

// ---- Decision: o que o Qualificador/Orquestrador devolve ao processor ----
export const DecisionSchema = z.object({
  mensagem_cliente: z.string().nullable(),
  acoes: z.array(AcaoSchema).default([]),
  temperatura: TemperaturaEnum.or(z.string()),
  estagio: EstagioEnum.or(z.string()),
  handoff: z.boolean().default(false),
  // metadados opcionais (nao enviados ao cliente; uteis p/ log/anti-loop)
  parseFailed: z.boolean().optional(),
  complianceViolations: z.array(z.any()).optional(),
});

// ---- AgentResult: saida dos especialistas (credito, objecoes, produto) ----
// Especialistas NUNCA enviam mensagem; so produzem contexto/dados para o Qualificador.
export const AgentResultSchema = z.object({
  agent: z.string(),
  summary: z.string().default(''),
  contextForPrompt: z.string().default(''),
  data: z.record(z.any()).default({}),
  flags: z.array(z.string()).default([]),
});

// ---- ComplianceResult: revisao final antes do envio ----
export const ViolationSchema = z.object({
  rule: z.string(),
  severity: z.enum(['baixa', 'media', 'alta']),
  excerpt: z.string().default(''),
});
export const ComplianceResultSchema = z.object({
  approved: z.boolean(),
  violations: z.array(ViolationSchema).default([]),
  revisedMessage: z.string().nullable().default(null),
});

/**
 * @typedef {Object} AgentContext
 * @property {Object} lead            Estado do lead (state.js)
 * @property {Object} knowledge       Resultado de loadKnowledge()
 * @property {Object} memory          Aprendizados curados deste lead (MemoryRepository)
 * @property {string} inboundText     Ultima mensagem do cliente
 * @property {string} now             Data/hora BRT (string)
 */

/**
 * @typedef {z.infer<typeof AgentResultSchema>} AgentResult
 * @typedef {z.infer<typeof DecisionSchema>} Decision
 * @typedef {z.infer<typeof ComplianceResultSchema>} ComplianceResult
 */

// Helper: cria um AgentResult vazio/valido para um agente.
export function emptyResult(agent) {
  return { agent, summary: '', contextForPrompt: '', data: {}, flags: [] };
}
