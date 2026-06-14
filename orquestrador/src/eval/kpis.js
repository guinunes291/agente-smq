// Agregacao de KPIs por agente a partir do stream de eventos (telemetry/events).
// Cada agente tem KPI proprio (auditoria exige: "nenhum agente sem KPI").
import { lerEventos } from '../telemetry/events.js';

// Definicao declarativa dos KPIs por agente (rastreabilidade).
export const KPIS = {
  qualificador: ['taxa_resposta', 'qualificacao_completa', 'taxa_agendamento', 'tempo_primeira_resposta'],
  objecoes: ['taxa_recuperacao', 'objecoes_frequentes'],
  credito: ['aderencia_faixa', 'fgts_mapeado'],
  produto: ['taxa_aderencia'],
  followup: ['taxa_reengajamento'],
  compliance: ['violacoes_por_mil', 'pct_bloqueadas'],
  memoria: ['precisao_campos'],
  orchestrator: ['turnos_por_conversa', 'custo_token_conversa', 'latencia_ms'],
};

/**
 * Agrega contagens e KPIs simples por agente a partir dos eventos.
 * @param {object[]} [eventos] opcional (default: le do arquivo)
 * @returns {Record<string, object>}
 */
export function agregarKpis(eventos) {
  const evs = eventos || lerEventos();
  const porAgente = {};

  for (const e of evs) {
    const a = e.agent || 'desconhecido';
    porAgente[a] = porAgente[a] || { eventos: 0, tipos: {}, kpis: {} };
    porAgente[a].eventos += 1;
    porAgente[a].tipos[e.type] = (porAgente[a].tipos[e.type] || 0) + 1;
    if (e.kpi && typeof e.value === 'number') {
      const k = porAgente[a].kpis[e.kpi] || { soma: 0, n: 0 };
      k.soma += e.value;
      k.n += 1;
      porAgente[a].kpis[e.kpi] = k;
    }
  }

  // media dos KPIs numericos
  for (const a of Object.keys(porAgente)) {
    for (const k of Object.keys(porAgente[a].kpis)) {
      const { soma, n } = porAgente[a].kpis[k];
      porAgente[a].kpis[k] = { media: n ? +(soma / n).toFixed(3) : 0, amostras: n };
    }
  }
  return porAgente;
}

/** Lista agentes que NAO emitiram nenhum evento (cobertura de observabilidade). */
export function agentesSemTelemetria(eventos) {
  const agg = agregarKpis(eventos);
  return Object.keys(KPIS).filter((a) => !agg[a]);
}
