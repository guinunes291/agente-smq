// Agente de Credito & Enquadramento (deterministico, sem custo de API).
// Estima faixa MCMV, parcela-teto (regra dos 30%), uso de FGTS, documentos e
// fatores de risco — SEM jamais prometer aprovacao. Apenas POSICIONA a analise.
// Base: 02-BASE-CONHECIMENTO/regras-mcmv-2026.md
import { emptyResult } from './contracts.js';

// Faixas MCMV (limite superior de renda mensal). Tratadas como ESTIMATIVA.
export const FAIXAS_MCMV = [
  { faixa: 'F1', rendaMax: 3200, subsidio: 'subsídio maior', taxa: '~4% a.a.' },
  { faixa: 'F2', rendaMax: 5000, subsidio: 'subsídio até R$ 55 mil', taxa: '5%–7% a.a.' },
  { faixa: 'F3', rendaMax: 9600, subsidio: 'sem subsídio', taxa: '7,66%–8,16% a.a.' },
  { faixa: 'F4', rendaMax: 13000, subsidio: 'sem subsídio', taxa: '~10% a.a.' },
];

// Extrai um valor numerico de renda de uma string como "2000-4400", "R$ 3.500", "ate 5000".
export function parseRenda(faixaRenda) {
  if (faixaRenda == null) return null;
  if (typeof faixaRenda === 'number') return faixaRenda;
  const nums = String(faixaRenda)
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const vals = nums.map(Number).filter((n) => n > 0);
  if (!vals.length) return null;
  // Em uma faixa "2000-4400" usamos o limite superior (mais conservador p/ enquadrar).
  return Math.max(...vals);
}

export function estimarFaixa(renda) {
  if (renda == null) return null;
  for (const f of FAIXAS_MCMV) if (renda <= f.rendaMax) return f;
  return null; // acima de F4 -> fora do MCMV (medio padrao / SFH)
}

/**
 * @param {import('./contracts.js').AgentContext} ctx
 * @returns {import('./contracts.js').AgentResult}
 */
export function analisarCredito(ctx) {
  const r = emptyResult('credito');
  const lead = ctx?.lead || {};
  const renda = parseRenda(lead.faixaRenda);

  if (renda == null) {
    r.flags.push('sem_renda');
    r.summary = 'Renda ainda desconhecida — perguntar para enquadrar.';
    r.contextForPrompt =
      'CREDITO: renda do lead ainda nao informada. Pergunte de forma leve quanto a familia recebe junta ' +
      '(pode compor renda com conjuge/filhos+18). Nao prometa aprovacao.';
    r.data = { rendaEstimada: null, faixa: null };
    return r;
  }

  const faixa = estimarFaixa(renda);
  const parcelaMax = Math.round(renda * 0.3); // regra dos 30%
  const riscos = [];
  const documentos = ['comprovante de renda', 'documento com foto', 'comprovante de residência'];

  // Sinais de risco a partir de dados ja coletados (quando existirem no lead).
  const obs = `${lead.objetivo || ''} ${lead.observacoes || ''} ${lead.tipoRenda || ''}`.toLowerCase();
  if (/informal|sem carteira|bico/.test(obs)) {
    riscos.push('renda informal: Caixa nao financia 100% informal — orientar MEI/composicao (nao descartar)');
    documentos.push('formalizacao (MEI) ou composicao de renda');
  }
  if (/mei|aut[oô]nomo/.test(obs)) {
    riscos.push('MEI/autonomo: Caixa usa media de faturamento (DECORE + extratos 6 meses)');
    documentos.push('DECORE + extratos bancarios (6 meses)');
  }
  if (/aposentad|inss/.test(obs)) {
    riscos.push('aposentado/INSS: atencao a idade (prazo + idade <= 80 anos e 6 meses)');
  }
  if (lead.imovelNoNome === true || /imovel no nome|tenho imovel/.test(obs)) {
    riscos.push('imovel em nome do comprador inviabiliza FGTS/subsidio — verificar na analise');
  }

  if (faixa) {
    r.summary = `Renda ~R$${renda} -> ${faixa.faixa} (${faixa.subsidio}). Parcela-teto estimada ~R$${parcelaMax}.`;
    r.contextForPrompt =
      `CREDITO (estimativa comercial, NAO prometer aprovacao): renda ~R$${renda} sugere faixa ${faixa.faixa} ` +
      `(${faixa.subsidio}, ${faixa.taxa}). Parcela maxima ~R$${parcelaMax} (regra dos 30%). ` +
      `FGTS (3+ anos) pode virar entrada/abater parcela — perguntar saldo. ` +
      `Reforce que a faixa/subsidio/parcela sao confirmados na analise da Caixa via corretor.` +
      (riscos.length ? ` Pontos de atencao: ${riscos.join('; ')}.` : '');
  } else {
    r.summary = `Renda ~R$${renda} acima de F4 -> fora do MCMV (medio padrao/SFH).`;
    r.contextForPrompt =
      `CREDITO: renda ~R$${renda} esta acima do MCMV (F4 ate R$13 mil). Posicione produtos de medio padrao/SFH ` +
      `(teto SFH/FGTS R$2,25 mi). Nao prometa aprovacao; a confirmacao e na analise.`;
  }

  r.data = {
    rendaEstimada: renda,
    faixa: faixa?.faixa || 'fora_mcmv',
    parcelaMaxEstimada: parcelaMax,
    subsidio: faixa?.subsidio || null,
    riscos,
    documentos,
  };
  return r;
}
