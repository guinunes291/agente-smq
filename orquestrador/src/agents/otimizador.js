// Agente Otimizador de Scripts (job offline — SCAFFOLD funcional-leve).
// Le as metricas de scripts e ranqueia as variantes por desempenho (taxa de
// handoff e de resposta). Na fase Avancada passa a GERAR novas variantes (LLM)
// e a rodar A/B automaticamente, atualizando os prompts.
import { agregarPorVariante } from '../eval/scriptMetrics.js';
import { emptyResult } from './contracts.js';

/**
 * Ranqueia variantes de script por desempenho.
 * @param {object} opts { minEnviados } amostra minima para considerar
 * @returns {import('./contracts.js').AgentResult}
 */
export function otimizarScripts({ minEnviados = 5 } = {}) {
  const r = emptyResult('otimizador');
  const agg = agregarPorVariante();
  const variantes = Object.entries(agg).map(([id, v]) => ({ id, ...v }));

  const elegiveis = variantes.filter((v) => v.enviados >= minEnviados);
  const ranqueadas = elegiveis.sort((a, b) => b.taxaHandoff - a.taxaHandoff || b.taxaResposta - a.taxaResposta);

  r.data = {
    totalVariantes: variantes.length,
    amostraInsuficiente: variantes.length - elegiveis.length,
    ranking: ranqueadas.slice(0, 10),
    melhor: ranqueadas[0] || null,
  };
  r.summary = ranqueadas.length
    ? `Otimizador: melhor variante ${ranqueadas[0].id} (handoff=${ranqueadas[0].taxaHandoff}).`
    : `Otimizador: sem variantes com amostra >= ${minEnviados}.`;
  // TODO(fase Avancada): gerar novas variantes via LLM e atualizar prompts/abertura.
  return r;
}
