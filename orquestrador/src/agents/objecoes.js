// Agente de Objeções (deterministico).
// Detecta a objecao na mensagem do cliente e devolve orientacao de abordagem
// fiel a base SMQ (base-conhecimento-smq/05-objecoes-comuns.md). Nao envia texto:
// so injeta contexto para o Qualificador conduzir.
import { emptyResult } from './contracts.js';
import { trechoObjecao } from '../knowledge.js';

// numero = secao correspondente em 05-objecoes-comuns.md (para anexar o script completo).
export const OBJECOES = [
  {
    key: 'vou_pensar', numero: 1,
    re: /vou pensar|preciso pensar|me d[áa] um tempo|pensar no assunto|ainda (estou|to) pensando/iu,
    guia: 'Objecao falsa: ha algo especifico travando. Valide e pergunte o que de fato impediria avancar hoje.',
  },
  {
    key: 'sem_entrada', numero: 2,
    re: /sem entrada|n[ãa]o tenho (a )?entrada|entrada (muito )?alta|n[ãa]o tenho (o )?valor da entrada|grana da entrada/iu,
    guia: 'Mostre que o FGTS pode abater boa parte da entrada e que ha parcelamento. Ofereca simulacao (sem prometer).',
  },
  {
    key: 'medo_credito', numero: 3,
    re: /nome sujo|nome restrito|nome (n[ãa]o (t[áa]|esta)|sujo) limpo|spc|serasa|restri[çc][ãa]o|negativ|medo (de|do) (aprovar|cr[ée]dito)|n[ãa]o sei se aprovo/iu,
    guia: '7 em 10 brasileiros tem pendencia. Normalize, proponha analise previa sem compromisso. NUNCA prometa aprovacao.',
  },
  {
    key: 'caro', numero: 4,
    re: /(muito |t[áa] |est[áa] )?caro|caro demais|parcela (alta|n[ãa]o cabe)|n[ãa]o cabe no (meu )?bolso|fora do (meu )?or[çc]amento/iu,
    guia: 'Compare parcela x aluguel; lembre subsidio e FGTS ainda nao aplicados. Refaca a conta com esses valores (com ressalva).',
  },
  {
    key: 'ver_opcoes', numero: 5,
    re: /outras op[çc][õo]es|ver outras|pesquisando|quero comparar|outras imobili|outros (im[óo]veis|empreend)/iu,
    guia: 'Valide a pesquisa. Pergunte 2-3 opcoes que ja olha e ofereca comparacao real (preco/m2, condominio, parcela final).',
  },
  {
    key: 'conjuge', numero: 6,
    re: /esposa|marido|c[ôo]njuge|minha mulher|meu marido|falar com (ele|ela)|decis[ãa]o (do casal|conjunta|da fam[íi]lia)/iu,
    guia: 'Decisor ausente (top de no-show). Inclua o conjuge: peca o WhatsApp dele(a) e ofereca chamada com os dois juntos.',
  },
  {
    key: 'medo_obra', numero: 7,
    re: /obra atras|atrasar|medo da obra|construtora (vai )?entregar|e se n[ãa]o entregar/iu,
    guia: 'Cite track record da construtora e o patrimonio de afetacao (entrada blindada por lei). Ofereca visitar entregue.',
  },
  {
    key: 'perder_fgts', numero: 8,
    re: /perder (o )?fgts|n[ãa]o quero (usar|perder) (o )?fgts/iu,
    guia: 'FGTS nao se perde: vira o imovel e continua sendo depositado. Compare rendimento FGTS x valorizacao (com ressalva).',
  },
  {
    key: 'nao_agora', numero: null,
    re: /n[ãa]o (quero|é|e) (agora|pra ja)|mais pra frente|depois eu vejo|sem pressa|outra hora/iu,
    guia: 'Sem urgencia declarada. Eduque com valor (subsidio pode mudar, aluguel x parcela) e mantenha cadencia leve, sem insistir.',
  },
  {
    key: 'medo_financiamento', numero: null,
    re: /medo de financiar|d[íi]vida (longa|de 30)|30 anos|me amarrar|me prender (a )?uma d[íi]vida/iu,
    guia: 'Trate o medo do prazo: SAC faz a 1a parcela ser a maior e cair; amortizacao com FGTS reduz prazo. Eduque sem pressionar.',
  },
];

/**
 * @param {import('./contracts.js').AgentContext} ctx
 * @returns {import('./contracts.js').AgentResult}
 */
export function detectarObjecao(ctx) {
  const r = emptyResult('objecoes');
  const texto = (ctx?.inboundText || '').toString();
  if (!texto.trim()) return r;

  const achadas = OBJECOES.filter((o) => o.re.test(texto));
  if (!achadas.length) return r;

  const keys = achadas.map((o) => o.key);
  r.data = { objecoesDetectadas: keys, principal: keys[0] };
  r.flags.push('objecao_detectada');
  r.summary = `Objecao(s): ${keys.join(', ')}`;

  const linhas = achadas.map((o) => {
    const script = o.numero ? trechoObjecao(o.numero) : '';
    const base = `- ${o.key}: ${o.guia}`;
    return script ? `${base}\n  [script SMQ]\n  ${script.replace(/\n/g, '\n  ')}` : base;
  });
  r.contextForPrompt =
    'OBJECOES detectadas na fala do cliente — trate com Validar > Perguntar > Enderecar > Acao:\n' +
    linhas.join('\n');
  return r;
}
