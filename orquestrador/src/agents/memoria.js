// Agente de Memoria Comercial.
// Extrai do turno apenas APRENDIZADOS UTEIS e curados (sem poluir, LGPD-minimo)
// para o MemoryRepository. Nao grava texto livre da conversa nem PII sensivel.
// A persistencia em si fica no repository.js (file agora, CRM depois).

/**
 * @param {object} p { lead, decision, objecoes, credito, produto }
 * @returns {object|null} patch a ser mesclado na memoria (ou null se nada util)
 */
export function extrairAprendizados({ lead, decision, objecoes, credito, produto }) {
  const patch = {};

  // Perfil comercial util
  if (lead.objetivo) patch.objetivo = lead.objetivo;
  if (lead.faixaRenda) patch.faixaRenda = lead.faixaRenda;
  if (lead.regiao) patch.regiao = lead.regiao;
  if (lead.empreendimentoInteresse) patch.empreendimentoInteresse = lead.empreendimentoInteresse;

  // Estagio/temperatura do funil (do decision, que ja passou pelo qualificador)
  if (decision?.temperatura) patch.temperatura = decision.temperatura;
  if (decision?.estagio) patch.estagio = decision.estagio;

  // Produto ideal estimado (1o match)
  const emp = produto?.data?.empreendimentos?.[0];
  if (emp?.nome) patch.produtoIdeal = emp.nome;

  // Objecoes vistas (acumulam sem duplicar — tratado no repository)
  const objs = objecoes?.data?.objecoesDetectadas;
  if (objs?.length) patch.objecoesVistas = objs;

  // Sinais de credito relevantes
  if (credito?.data?.faixa && credito.data.faixa !== 'fora_mcmv') {
    patch.aprendizados = [`faixa_estimada:${credito.data.faixa}`];
  }

  return Object.keys(patch).length ? patch : null;
}
