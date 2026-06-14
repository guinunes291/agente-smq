// Agente de Treinamento: transforma conversas vencedoras, objecoes e aprendizados
// em material interno (playbook/FAQ/atualizacoes de script). MVP: estrutura o
// playbook a partir da base de objecoes + ranking de scripts. Saida -> revisao do gestor.
import { loadKnowledge } from '../knowledge.js';
import { otimizarScripts } from './scientist.js';
import { OBJECOES } from '../agents/objecoes.js';

/**
 * Gera um rascunho de playbook para revisao humana.
 * @returns {{playbook:object, gerteradoEm:string}}
 */
export function gerarPlaybook() {
  const { faq } = loadKnowledge();
  const ranking = otimizarScripts().data;

  const objecoes = OBJECOES.map((o) => ({ objecao: o.key, abordagem: o.guia }));

  return {
    geradoEm: new Date().toISOString(),
    playbook: {
      aberturasRecomendadas: ranking.melhor ? [ranking.melhor] : [],
      objecoes,
      faqResumo: (faq || '').slice(0, 1200),
      observacao: 'Rascunho automatico — requer revisao do gestor antes de virar treinamento oficial.',
    },
  };
}
