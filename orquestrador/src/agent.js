// Cerebro do agente: monta o prompt, chama a Anthropic e devolve o JSON de acao.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { contextoConhecimento } from './tools.js';
import { nextRotationIndex } from './state.js';

let client = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

// Permite injetar um "cerebro" falso em testes de ponta a ponta (sem chamar a API real).
export function setClientForTest(fakeClient) {
  client = fakeClient;
}

function buildSystem(lead) {
  const { systemPrompt, guiaConversa } = loadKnowledge();
  const ctx = contextoConhecimento(lead);
  const empResumo = ctx.empreendimentos
    .map((e) => `- ${e.nome} | ${e.regiao}/${e.bairro} | ${e.tipo_produto} | ${e.dormitorios} dorm | ${e.metragem_m2}m2 | de R$${e.preco_de || '?'} por R$${e.preco_por || '?'} | corretor_id:${e.corretor_responsavel_id}`)
    .join('\n') || '(sem match - faca mais 1 pergunta para reposicionar, nao descarte)';
  const corretor = ctx.corretorSugerido ? `${ctx.corretorSugerido.nome} (id ${ctx.corretorSugerido.id})` : 'Plantonista (fallback)';

  const now = new Date(Date.now() + config.ops.tzOffset * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);

  const injected = `

=== CONTEXTO DESTE LEAD (injetado em tempo real) ===
LEAD: ${lead.nome || 'desconhecido'} | ${lead.phone} | origem: ${lead.origem || '-'}
Dados ja coletados: objetivo=${lead.objetivo || '-'}, renda=${lead.faixaRenda || '-'}, regiao=${lead.regiao || '-'}, interesse=${lead.empreendimentoInteresse || '-'}, temperatura=${lead.temperatura}, estagio=${lead.estagio}, convites_feitos=${lead.convitesAnaliseVisita}
Empreendimentos que dao match:
${empResumo}
Corretor sugerido para handoff: ${corretor}
Data/hora atual (BRT): ${now}

=== FORMATO OBRIGATORIO DA SUA RESPOSTA ===
Responda SOMENTE com um JSON valido (sem texto fora do JSON, sem markdown), no formato:
{
  "mensagem_cliente": "string (o que vai pro WhatsApp; max ~4 linhas; pt-BR; humano)",
  "acoes": [ {"tool":"SALVAR_LEAD","args":{"nome":"...","objetivo":"...","faixaRenda":"...","regiao":"...","empreendimentoInteresse":"...","fgts":"...","decisor":"...","urgencia":"...","temperatura":"...","estagio":"..."}} ],
  "temperatura": "FRIO|MORNO|QUENTE|PRONTO",
  "estagio": "primeiro_contato|qualificando|oferta_visita|oferta_analise|handoff|encerrado",
  "handoff": false
}
Regras do JSON:
- IDIOMA: "mensagem_cliente" SEMPRE em portugues do Brasil PERFEITO — acentuacao, cedilha (ç) e pontuacao corretas, ortografia e concordancia impecaveis. Nunca escreva sem acento.
- Sempre inclua uma acao SALVAR_LEAD com os campos que voce conseguiu inferir nesta mensagem.
- Se o cliente ACEITOU a analise de credito OU confirmou visita OU pediu humano: inclua {"tool":"HANDOFF","args":{"motivo":"analise|visita|humano","resumo":"..."}} e "handoff": true.
- Se o cliente pediu para parar (SAIR/PARAR): inclua {"tool":"OPT_OUT"} e encerre.
- Nao invente valores/plantas que nao estejam nos empreendimentos acima.`;

  const guia = guiaConversa ? `\n\n=== GUIA DE CONVERSA SMQ (siga este estilo) ===\n${guiaConversa}` : '';

  // PROMPT CACHING: separamos o system em dois blocos.
  // - Bloco ESTATICO (doutrina + guia, ~3.4k tokens): identico em todo turno -> marcado com
  //   cache_control para a Anthropic reaproveitar (paga-se ~10% do input em cache hit).
  // - Bloco DINAMICO (contexto deste lead + formato): muda a cada turno -> fica fora do cache.
  // A ORDEM do conteudo e identica a antes (estatico + injected) -> comportamento inalterado.
  const estatico = systemPrompt + guia;
  return [
    { type: 'text', text: estatico, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: injected },
  ];
}

function extractJSON(text) {
  if (!text) return null;
  let t = text.trim();
  // remove cercas de codigo se houver
  t = t.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ANGULOS de abertura (variantes A/B). Cada lead recebe UM angulo, registrado em
// lead.aberturaVariante -> permite metrificar a taxa de resposta por estilo ao longo do tempo.
const ANGULOS_ABERTURA = [
  { id: 'empreendimento', regra: 'Foque no empreendimento em que o lead se cadastrou (cite pelo nome) e por que vale a pena.' },
  { id: 'subsidio', regra: 'Foque no subsidio do MCMV: um valor do governo que abate no financiamento e que ele pode ter direito.' },
  { id: 'aluguel', regra: 'Foque em sair do aluguel: trocar o aluguel (que nao volta) pela parcela de um imovel que e dele.' },
  { id: 'parcela', regra: 'Foque na parcela caber no bolso, parecida com um aluguel, pra faixa de renda dele.' },
  { id: 'realizacao', regra: 'Foque na realizacao e seguranca de conquistar o primeiro imovel proprio.' },
];

// Estrutura fixa da saudacao: "Aqui é o Guilherme, dono da imobiliária Seu Metro Quadrado,
// e vi o seu interesse no [Empreendimento], isso mesmo?" + variacao por angulo a partir dai.
function saudacaoBase(l) {
  const interesse = l.empreendimentoInteresse
    ? `vi o seu interesse no ${l.empreendimentoInteresse}, isso mesmo?`
    : `vi o seu interesse em conquistar o seu imóvel, isso mesmo?`;
  return `Oi ${l.nome || ''}! Aqui é o Guilherme, dono da imobiliária Seu Metro Quadrado, e ${interesse}`;
}
const FALLBACK_POR_ANGULO = {
  empreendimento: (l) => `${saudacaoBase(l)} Posso te mostrar as condições e já adiantar a sua análise?`,
  subsidio: (l) => `${saudacaoBase(l)} Pela sua renda, você pode ter direito ao subsídio do MCMV — quer que eu veja quanto fica no seu caso?`,
  aluguel: (l) => `${saudacaoBase(l)} Posso te mostrar como trocar o aluguel pela parcela de um imóvel que é seu?`,
  parcela: (l) => `${saudacaoBase(l)} Dá pra ter uma parcela que cabe no seu bolso — quer que eu faça a conta pro seu caso?`,
  realizacao: (l) => `${saudacaoBase(l)} Bora dar o primeiro passo pra conquistar o seu imóvel?`,
};

function escolherAngulo(lead) {
  let pool = ANGULOS_ABERTURA;
  if (!lead.empreendimentoInteresse) pool = pool.filter((a) => a.id !== 'empreendimento');
  const idx = nextRotationIndex('abertura', pool.length); // rotaciona -> distribuicao equilibrada entre estilos
  return pool[idx];
}

function aberturaFallback(lead, anguloId) {
  const f = FALLBACK_POR_ANGULO[anguloId] || FALLBACK_POR_ANGULO.aluguel;
  return f(lead);
}

// Remove qualquer "responda SAIR"/opt-out que o modelo insista em adicionar.
function limparOptOut(t) {
  return t
    .replace(/\s*[\(\-–]?\s*(se (n[aã]o quiser|preferir)[^.]*?sair|responda\s+sair|para parar[^.]*?sair|caso n[aã]o queira[^.]*?sair)[\)]?\.?\s*$/i, '')
    .trim();
}

// Gera UMA mensagem de primeiro contato, no angulo sorteado (varia + registra a variante).
export async function gerarPrimeiroContato(lead) {
  const angulo = escolherAngulo(lead);
  lead.aberturaVariante = angulo.id; // <- metrica: qual estilo foi usado neste lead
  if (!client) return aberturaFallback(lead, angulo.id);
  const { guiaConversa } = loadKnowledge();
  const interesse = lead.empreendimentoInteresse
    ? `vi o seu interesse no ${lead.empreendimentoInteresse}, isso mesmo?`
    : `vi o seu interesse em conquistar o seu imóvel, isso mesmo?`;
  const sys =
    `Voce atende como GUILHERME, dono da imobiliaria Seu Metro Quadrado (MCMV). ` +
    `Escreva UMA mensagem de PRIMEIRO contato no WhatsApp para um lead.\n` +
    `ESTRUTURA OBRIGATORIA (siga exatamente este inicio, pode variar pequenas palavras mas mantenha o sentido):\n` +
    `  "Oi ${lead.nome || '[nome]'}! Aqui é o Guilherme, dono da imobiliária Seu Metro Quadrado, e ${interesse}"\n` +
    `Depois desse inicio, ACRESCENTE uma curta continuacao (1 frase) no ANGULO: ${angulo.regra}\n` +
    `Regras: maximo 4 linhas; tom humano, caloroso e simples; termine com UMA pergunta/CTA leve; ` +
    `NAO use colchetes/placeholder; NAO prometa aprovacao; NAO inclua opt-out nem "responda SAIR"; ` +
    `varie a redacao da continuacao a cada vez (nao repita formula fixa), mas SEMPRE se apresente como "Guilherme, dono da imobiliária Seu Metro Quadrado" e confirme o interesse com "isso mesmo?".\n` +
    `IDIOMA: escreva em portugues do Brasil PERFEITO — com acentuacao, cedilha (ç) e pontuacao corretas, ortografia e concordancia impecaveis. Jamais escreva sem acento.\n` +
    `Responda APENAS com o texto da mensagem, sem aspas e sem explicacao.\n\n` +
    `Resumo de estilo SMQ:\n${(guiaConversa || '').slice(0, 1500)}`;
  const user = `Lead: nome=${lead.nome || '-'}, empreendimento=${lead.empreendimentoInteresse || '-'}, objetivo=${lead.objetivo || '-'}, faixaRenda=${lead.faixaRenda || '-'}. Escreva a saudacao seguindo a estrutura, com a continuacao no angulo "${angulo.id}".`;
  try {
    const resp = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 220,
      temperature: 0.95,
      system: sys,
      messages: [{ role: 'user', content: user }],
    });
    let t = resp.content?.map((b) => b.text || '').join('').trim() || '';
    t = limparOptOut(t.replace(/^["'`]+|["'`]+$/g, '').trim());
    return t || aberturaFallback(lead, angulo.id);
  } catch (e) {
    console.error('[agent] gerarPrimeiroContato falhou:', e.message);
    return aberturaFallback(lead, angulo.id);
  }
}

// Gera um RESUMO da conversa de qualificacao (para preencher no CRM no handoff).
export async function gerarResumoConversa(lead) {
  const fields =
    `Objetivo: ${lead.objetivo || '-'} | Renda: ${lead.faixaRenda || '-'} | Regiao: ${lead.regiao || '-'} | ` +
    `Interesse: ${lead.empreendimentoInteresse || '-'} | FGTS: ${lead.fgts || '-'} | Decisor: ${lead.decisor || '-'} | ` +
    `Temperatura: ${lead.temperatura}`;
  if (!client) return `Resumo (auto): ${fields}`;
  try {
    const transcript = (lead.history || [])
      .map((h) => `${h.role === 'user' ? 'Cliente' : 'Agente'}: ${h.content}`)
      .join('\n')
      .slice(-4000);
    const resp = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 300,
      temperature: 0.2,
      system: 'Resuma a conversa de qualificacao imobiliaria em portugues para o CORRETOR que vai assumir o lead. ' +
        'Seja objetivo (5-8 linhas): perfil do lead, objetivo, renda/FGTS, regiao, empreendimento de interesse, urgencia, ' +
        'objecoes/duvidas, e o que ele aceitou (visita/analise) com horario preferido se houver. Sem floreio.',
      messages: [{ role: 'user', content: `Campos coletados: ${fields}\n\nTranscricao:\n${transcript}` }],
    });
    const t = resp.content?.map((b) => b.text || '').join('').trim();
    return t || `Resumo (auto): ${fields}`;
  } catch (e) {
    console.error('[agent] gerarResumoConversa falhou:', e.message);
    return `Resumo (auto): ${fields}`;
  }
}

// Garante alternancia user/assistant comecando por user (requisito da API).
// Mescla mensagens consecutivas do mesmo papel e descarta assistant inicial.
function normalizeHistory(history) {
  const out = [];
  for (const h of history) {
    const content = (h.content || '').toString();
    if (!content.trim()) continue;
    if (out.length === 0 && h.role !== 'user') continue; // tem que comecar por user
    const last = out[out.length - 1];
    if (last && last.role === h.role) {
      last.content += '\n' + content; // mescla mesmo papel consecutivo
    } else {
      out.push({ role: h.role, content });
    }
  }
  // se terminar em assistant, removemos para o prefill assistant fazer sentido
  while (out.length && out[out.length - 1].role === 'assistant') out.pop();
  // CAP DE HISTORICO: mantem apenas os ultimos ~12 turnos. O estado do lead (objetivo, renda,
  // regiao, temperatura, estagio) ja vai resumido no bloco injetado do system, entao cortar os
  // turnos crus mais antigos NAO perde a qualificacao - so evita custo crescente em conversa longa.
  const MAX_MSGS = 24;
  if (out.length > MAX_MSGS) out.splice(0, out.length - MAX_MSGS);
  // apos o corte, garante que ainda comeca por 'user' (requisito da API)
  while (out.length && out[0].role !== 'user') out.shift();
  if (out.length === 0) out.push({ role: 'user', content: '(novo contato)' });
  return out;
}

export async function runAgent(lead) {
  if (!client) {
    // Modo sem API (teste local): resposta-stub previsivel
    return {
      mensagem_cliente: '[STUB sem ANTHROPIC_API_KEY] Ola! Aqui e o time da Seu Metro Quadrado. Voce busca pra morar ou investir?',
      acoes: [{ tool: 'SALVAR_LEAD', args: { estagio: 'qualificando', temperatura: 'MORNO' } }],
      temperatura: 'MORNO',
      estagio: 'qualificando',
      handoff: false,
    };
  }

  const system = buildSystem(lead);
  // Normaliza o historico: alternancia user/assistant (a API exige), comecando por user.
  const hist = normalizeHistory(lead.history);
  // PREFILL: forcamos a resposta a comecar com '{' -> saida sempre em JSON valido.
  const messages = [...hist, { role: 'assistant', content: '{' }];

  let parsed = null;
  let rawForLog = '';
  try {
    const resp = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      temperature: 0.4,
      system,
      messages,
    });
    // como demos prefill '{', o texto retornado e a continuacao do JSON
    const cont = resp.content?.map((b) => b.text || '').join('') || '';
    rawForLog = cont;
    parsed = extractJSON('{' + cont);
    if (resp.stop_reason === 'max_tokens') console.warn('[agent] resposta truncada (max_tokens).');
  } catch (e) {
    console.error('[agent] erro na API:', e.status || '', e.message);
  }

  if (!parsed || typeof parsed.mensagem_cliente !== 'string') {
    console.error('[agent] JSON invalido/sem mensagem. Bruto:', String(rawForLog).slice(0, 300));
    // NAO repetir frase fixa. Nao envia nada neste turno (evita loop); so registra.
    return {
      mensagem_cliente: null,
      acoes: [],
      temperatura: lead.temperatura,
      estagio: lead.estagio,
      handoff: false,
      parseFailed: true,
    };
  }
  return parsed;
}
