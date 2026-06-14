// Cientista de Vendas (consolida os antigos Analista + Otimizador).
// Modos: analisarConversas (padroes/queda), otimizarScripts (ranking por desempenho),
// gerarHipoteses (candidatas a experimento -> fila de revisao humana).
// Offline. Nao promove nada sozinho: hipoteses vao para experiments.js (human-in-loop).
import fs from 'fs';
import { _LOG_FILE } from '../logs/decisionLog.js';
import { agregarPorVariante } from '../eval/scriptMetrics.js';
import { emptyResult } from '../agents/contracts.js';

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

/** MODO 1 — padroes agregados das conversas (ex-Analista). */
export function analisarConversas(file) {
  const r = emptyResult('scientist');
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
  r.summary = `Conversas: ${decisoes.length} turnos, handoff=${r.data.taxaHandoff}.`;
  return r;
}

/** MODO 2 — ranking de variantes de script por desempenho (ex-Otimizador). */
export function otimizarScripts({ minEnviados = 5 } = {}) {
  const r = emptyResult('scientist');
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
    ? `Melhor variante ${ranqueadas[0].id} (handoff=${ranqueadas[0].taxaHandoff}).`
    : `Sem variantes com amostra >= ${minEnviados}.`;
  return r;
}

/**
 * MODO 3 — gera hipoteses de melhoria a partir dos padroes (candidatas a experimento).
 * NAO altera nada: devolve hipoteses para revisao humana (experiments.propor()).
 */
export function gerarHipoteses(file) {
  const a = analisarConversas(file).data;
  const o = otimizarScripts().data;
  const hipoteses = [];

  // Objecao dominante -> hipotese de melhorar o script daquela objecao.
  const objs = Object.entries(a?.objecoesRecorrentes || {}).sort((x, y) => y[1] - x[1]);
  if (objs.length) {
    hipoteses.push({
      tipo: 'script_objecao',
      alvo: objs[0][0],
      hipotese: `A objecao "${objs[0][0]}" e a mais frequente (${objs[0][1]}x). Testar variante de resposta com prova social/numero concreto.`,
      metricaAlvo: 'taxa_recuperacao',
    });
  }
  // Muitas mensagens bloqueadas -> hipotese de ajustar prompt do Qualificador.
  if ((a?.mensagensBloqueadas || 0) > 0) {
    hipoteses.push({
      tipo: 'prompt_compliance',
      alvo: 'qualificador',
      hipotese: `${a.mensagensBloqueadas} mensagens bloqueadas pelo Compliance. Reforcar no prompt a proibicao de promessa/valor sem ressalva.`,
      metricaAlvo: 'pct_bloqueadas',
    });
  }
  // Melhor variante de abertura -> hipotese de torna-la padrao.
  if (o?.melhor) {
    hipoteses.push({
      tipo: 'promover_variante',
      alvo: o.melhor.id,
      hipotese: `Variante ${o.melhor.id} tem maior taxa de handoff (${o.melhor.taxaHandoff}). Avaliar promove-la a abertura padrao.`,
      metricaAlvo: 'taxa_handoff',
    });
  }

  const r = emptyResult('scientist');
  r.data = { hipoteses };
  r.summary = `${hipoteses.length} hipotese(s) gerada(s) para revisao humana.`;
  return r;
}
