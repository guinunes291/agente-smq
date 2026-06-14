// Agente de Qualidade: avalia uma conversa e da nota 0-100 por rubrica, com
// explicacao e sugestoes. MVP deterministico (heuristica sobre o historico);
// o hook scoreLLM fica desenhado para a fase Estavel (avaliacao semantica).
import { canonical } from '../lib/normalize.js';

// Pesos da rubrica (somam 100).
export const RUBRICA = {
  rapport: 15,
  descoberta: 20,
  qualificacao: 20,
  objecoes: 15,
  clareza: 10,
  assertividade: 10,
  chance_conversao: 10,
};

const PERGUNTAS_DESCOBERTA = /(renda|ganha|recebe|regi[ãa]o|bairro|morar|investir|urg|prazo|quando|fgts|entrada|alugu)/i;

/**
 * @param {Array<{role:string, content:string}>} history
 * @param {object} meta { temperatura, estagio, handoff }
 * @returns {{score:number, breakdown:object, sugestoes:string[]}}
 */
export function avaliarConversa(history = [], meta = {}) {
  const msgsAgente = history.filter((h) => h.role === 'assistant');
  const msgsCliente = history.filter((h) => h.role === 'user');
  const textoAgente = msgsAgente.map((m) => m.content || '').join(' ');
  const c = canonical(textoAgente);

  const b = {};
  const sugestoes = [];

  // Rapport: usou o nome / tom caloroso / sem "tudo bem?" generico
  b.rapport = /\b(oi|ola|opa)\b/.test(c) && !/tudo bem\?/.test(c) ? RUBRICA.rapport : Math.round(RUBRICA.rapport * 0.5);
  if (b.rapport < RUBRICA.rapport) sugestoes.push('Personalize a abertura (use o nome, evite "tudo bem?").');

  // Descoberta: fez perguntas de qualificacao
  const nPerguntas = msgsAgente.filter((m) => /\?/.test(m.content || '') && PERGUNTAS_DESCOBERTA.test(m.content || '')).length;
  b.descoberta = Math.min(RUBRICA.descoberta, nPerguntas * 7);
  if (nPerguntas < 2) sugestoes.push('Aprofunde a descoberta (renda, regiao, urgencia, FGTS).');

  // Qualificacao: cobriu dimensoes (renda + objetivo + regiao + urgencia)
  const dims = ['renda|ganha|recebe', 'morar|investir', 'regi[ãa]o|bairro', 'urg|prazo|quando'].filter((d) => new RegExp(d).test(c)).length;
  b.qualificacao = Math.round((dims / 4) * RUBRICA.qualificacao);
  if (dims < 3) sugestoes.push('Complete a qualificacao das 7 dimensoes.');

  // Objecoes: validou/perguntou diante de resistencia do cliente
  const clienteObjetou = msgsCliente.some((m) => /caro|pensar|entrada|nome|c[ôo]njuge|marido|esposa/i.test(m.content || ''));
  b.objecoes = !clienteObjetou ? RUBRICA.objecoes : /entendo|imagino|faz sentido|claro/i.test(textoAgente) ? RUBRICA.objecoes : Math.round(RUBRICA.objecoes * 0.4);
  if (clienteObjetou && b.objecoes < RUBRICA.objecoes) sugestoes.push('Trate objecoes com Validar > Perguntar > Enderecar > Acao.');

  // Clareza: mensagens curtas (proxy: media de caracteres)
  const mediaLen = msgsAgente.length ? textoAgente.length / msgsAgente.length : 0;
  b.clareza = mediaLen > 0 && mediaLen <= 400 ? RUBRICA.clareza : Math.round(RUBRICA.clareza * 0.5);
  if (b.clareza < RUBRICA.clareza) sugestoes.push('Reduza o tamanho das mensagens (1 ideia por vez).');

  // Assertividade: terminou com CTA/pergunta
  const ultima = msgsAgente[msgsAgente.length - 1]?.content || '';
  b.assertividade = /\?|vamos|posso|que tal|bora/i.test(ultima) ? RUBRICA.assertividade : Math.round(RUBRICA.assertividade * 0.4);
  if (b.assertividade < RUBRICA.assertividade) sugestoes.push('Feche cada mensagem com um CTA claro.');

  // Chance de conversao: proxy pelo estagio/temperatura/handoff
  const quente = ['QUENTE', 'PRONTO'].includes(meta.temperatura) || meta.handoff;
  b.chance_conversao = quente ? RUBRICA.chance_conversao : ['MORNO'].includes(meta.temperatura) ? Math.round(RUBRICA.chance_conversao * 0.6) : Math.round(RUBRICA.chance_conversao * 0.3);

  const score = Object.values(b).reduce((s, v) => s + v, 0);
  return { score, breakdown: b, sugestoes };
}

/**
 * Hook para avaliacao semantica via LLM (fase Estavel). Desenhado, nao ativo.
 * @returns {Promise<null>}
 */
export async function scoreLLM(/* history, meta */) {
  // TODO(fase Estavel): chamar o modelo com a rubrica e devolver nota + justificativa.
  return null;
}
