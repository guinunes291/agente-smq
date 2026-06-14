// Agente de Produto Imobiliario (funcional-leve).
// Conecta o perfil do lead ao(s) empreendimento(s) ideal(is) reaproveitando
// buscarEmpreendimentos/buscarCorretor. Devolve contexto para o Qualificador;
// nao envia mensagem nem inventa valores fora do catalogo.
import { emptyResult } from './contracts.js';
import { buscarEmpreendimentos, buscarCorretor } from '../knowledge.js';

/**
 * @param {import('./contracts.js').AgentContext} ctx
 * @returns {import('./contracts.js').AgentResult}
 */
export function sugerirProduto(ctx) {
  const r = emptyResult('produto');
  const lead = ctx?.lead || {};

  const emp = buscarEmpreendimentos({
    regiao: lead.regiao,
    objetivo: lead.objetivo,
    faixaPreco: ctx?.credito?.parcelaMaxEstimada ? undefined : undefined,
  });
  const corretor = buscarCorretor({ regiao: lead.regiao });

  r.data = {
    empreendimentos: emp,
    corretorSugerido: corretor ? { id: corretor.id, nome: corretor.nome } : null,
  };

  if (!emp.length) {
    r.flags.push('sem_match');
    r.summary = 'Sem match de produto — reposicionar com 1 pergunta (nao descartar).';
    r.contextForPrompt =
      'PRODUTO: nenhum empreendimento deu match com os dados atuais. Faca MAIS 1 pergunta para reposicionar ' +
      '(regiao, objetivo, perfil) — nao descarte o lead.';
    return r;
  }

  const linhas = emp.map(
    (e) =>
      `- ${e.nome} | ${e.regiao}/${e.bairro} | ${e.tipo_produto} | ${e.dormitorios} dorm | ${e.metragem_m2}m2 | ` +
      `de R$${e.preco_de || '?'} por R$${e.preco_por || '?'} | entrega: ${e.previsao_entrega || '-'} | ` +
      `corretor_id:${e.corretor_responsavel_id}`,
  );
  r.summary = `${emp.length} empreendimento(s) com match.`;
  r.contextForPrompt =
    'PRODUTO — empreendimentos que dao match (use SOMENTE estes valores; cite com ressalva de disponibilidade):\n' +
    linhas.join('\n');
  return r;
}
