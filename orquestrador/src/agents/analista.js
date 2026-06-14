// Agente Analista de Conversas (job offline — SCAFFOLD).
// Estuda conversas/decisoes passadas para achar padroes: objecoes recorrentes,
// pontos de queda, perguntas que funcionam. No MVP entrega um resumo basico a
// partir do log de decisao; a analise semantica (LLM) entra na fase Estavel.
import fs from 'fs';
import { _LOG_FILE } from '../logs/decisionLog.js';
import { emptyResult } from './contracts.js';

function lerDecisoes(file = _LOG_FILE) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Analisa o historico de decisoes e devolve padroes agregados.
 * @returns {import('./contracts.js').AgentResult}
 */
export function analisarConversas(file) {
  const r = emptyResult('analista');
  const decisoes = lerDecisoes(file);
  if (!decisoes.length) {
    r.summary = 'Sem decisoes registradas ainda.';
    return r;
  }

  const objecoes = {};
  let handoffs = 0;
  let bloqueadas = 0;
  const violacoes = {};
  for (const d of decisoes) {
    if (d.objecaoDetectada) objecoes[d.objecaoDetectada] = (objecoes[d.objecaoDetectada] || 0) + 1;
    if (d.handoff) handoffs += 1;
    if (d.bloqueada) bloqueadas += 1;
    for (const v of d.complianceViolations || []) violacoes[v] = (violacoes[v] || 0) + 1;
  }

  r.data = {
    totalTurnos: decisoes.length,
    taxaHandoff: +(handoffs / decisoes.length).toFixed(3),
    objecoesRecorrentes: objecoes,
    violacoesCompliance: violacoes,
    mensagensBloqueadas: bloqueadas,
  };
  r.summary = `Analista: ${decisoes.length} turnos, handoff=${r.data.taxaHandoff}, objecoes=${Object.keys(objecoes).join(',') || '-'}.`;
  // TODO(fase Estavel): clusterizar pontos de queda e perguntas que convertem via LLM.
  return r;
}
