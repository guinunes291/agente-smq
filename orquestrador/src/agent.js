// Cerebro do agente: monta o prompt, chama a Anthropic e devolve o JSON de acao.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { contextoConhecimento } from './tools.js';
import { nextRotationIndex } from './state.js';

let client = config.anthropic.apiKey
  ? new Anthropic({ apiKey: config.anthropic.apiKey, maxRetries: 4, timeout: 60000 })
  : null;

// Log detalhado de erro da API (status, tipo, causa) para diagnostico.
function logApiError(tag, e) {
  const status = e?.status || e?.statusCode || '';
  const tipo = e?.error?.error?.type || e?.error?.type || e?.name || '';
  const msg = e?.error?.error?.message || e?.message || '';
  const causa = e?.cause?.message || '';
  console.error(`[agent] ${tag} -> status=${status} tipo=${tipo} msg=${msg} causa=${causa}`);
}

// Permite injetar um "cerebro" falso em testes de ponta a ponta (sem chamar a API real).
export function setClientForTest(fakeClient) {
  client = fakeClient;
}

function buildSystem(lead) {
  const { systemPrompt, guiaConversa, materiaisApoio } = loadKnowledge();
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
- "mensagem_cliente" deve conter EXATAMENTE UMA pergunta (uma so). Nunca duas perguntas na mesma mensagem.
- IDIOMA: "mensagem_cliente" SEMPRE em portugues do Brasil PERFEITO (acentuacao, cedilha, pontuacao, concordancia). Nunca escreva sem acento. NUNCA use travessao ("—"); use virgula ou ponto. Tom natural e humano, nada robotizado.
- Sempre inclua uma acao SALVAR_LEAD com os campos que voce conseguiu inferir nesta mensagem.
- Se o cliente ACEITOU a analise de credito OU confirmou visita OU pediu humano: inclua {"tool":"HANDOFF","args":{"motivo":"analise|visita|humano","resumo":"..."}} e "handoff": true.
- Se o cliente pediu para parar (SAIR/PARAR): inclua {"tool":"OPT_OUT"} e encerre.
- Nao invente valores/plantas que nao estejam nos empreendimentos acima.`;

  const guia = guiaConversa ? `\n\n=== GUIA DE CONVERSA SMQ (siga este estilo) ===\n${guiaConversa}` : '';
  const apoio = materiaisApoio ? `\n\n=== MATERIAIS DE APOIO (consulte para objecoes, vocabulario e exemplos) ===\n${materiaisApoio}` : '';

  // PROMPT CACHING: separamos o system em dois blocos.
  // - Bloco ESTATICO (doutrina + guia + materiais de apoio): identico em todo turno -> cache_control
  //   para a Anthropic reaproveitar (paga-se ~10% do input em cache hit).
  // - Bloco DINAMICO (contexto deste lead + formato): muda a cada turno -> fica fora do cache.
  const estatico = systemPrompt + guia + apoio;
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

// A 1a mensagem é APENAS a confirmacao de interesse, com UMA UNICA pergunta.
// Variamos a REDACAO (estilo) e registramos em lead.aberturaVariante p/ metrificar taxa de resposta.
function alvoInteresse(l) {
  return l.empreendimentoInteresse ? `no ${l.empreendimentoInteresse}` : 'em conquistar o seu imóvel';
}
const ESTILOS_SAUDACAO = {
  direto: (l) => `Oi ${l.nome || ''}! Aqui é o Guilherme, dono da imobiliária Seu Metro Quadrado. Vi o seu interesse ${alvoInteresse(l)}, é isso mesmo?`,
  caloroso: (l) => `Oi ${l.nome || ''}, tudo bem? Aqui é o Guilherme, dono da imobiliária Seu Metro Quadrado. Vi que você se interessou ${alvoInteresse(l)}, é isso mesmo?`,
  pessoal: (l) => `Olá ${l.nome || ''}! Quem fala é o Guilherme, dono da imobiliária Seu Metro Quadrado. Você demonstrou interesse ${alvoInteresse(l)}, certo?`,
};
const ESTILOS_IDS = Object.keys(ESTILOS_SAUDACAO);

function escolherEstilo() {
  const idx = nextRotationIndex('abertura', ESTILOS_IDS.length); // rotaciona p/ distribuicao equilibrada
  return ESTILOS_IDS[idx];
}

function aberturaFallback(lead, estiloId) {
  const f = ESTILOS_SAUDACAO[estiloId] || ESTILOS_SAUDACAO.direto;
  return semTravessao(f(lead));
}

// Remove travessao (— e –) das mensagens ao cliente -> linguagem mais natural, menos robotizada.
export function semTravessao(t) {
  if (!t) return t;
  return t
    .replace(/\s*[—–]\s*/g, ', ')   // "texto — texto" vira "texto, texto"
    .replace(/,\s*([?!.;:])/g, '$1') // conserta ", ?" -> "?"
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Remove qualquer "responda SAIR"/opt-out que o modelo insista em adicionar.
function limparOptOut(t) {
  return t
    .replace(/\s*[\(\-–]?\s*(se (n[aã]o quiser|preferir)[^.]*?sair|responda\s+sair|para parar[^.]*?sair|caso n[aã]o queira[^.]*?sair)[\)]?\.?\s*$/i, '')
    .trim();
}

// Gera a 1a mensagem: APENAS a confirmacao de interesse (1 unica pergunta), variando a redacao.
export async function gerarPrimeiroContato(lead) {
  const estilo = escolherEstilo();
  lead.aberturaVariante = estilo; // <- metrica: qual estilo de saudacao foi usado neste lead
  if (!client) return aberturaFallback(lead, estilo);
  const alvo = alvoInteresse(lead);
  const sys =
    `Voce atende como GUILHERME, dono da imobiliaria Seu Metro Quadrado (MCMV).\n` +
    `Escreva a PRIMEIRA mensagem no WhatsApp. Ela deve ser APENAS a confirmacao do interesse — nada alem disso.\n` +
    `Conteudo: cumprimente pelo nome; diga que "Aqui e o Guilherme, dono da imobiliaria Seu Metro Quadrado"; ` +
    `e confirme o interesse ${alvo} terminando com UMA UNICA pergunta de confirmacao (ex.: "e isso mesmo?", "isso mesmo?", "certo?").\n` +
    `PROIBIDO: segunda frase de oferta, CTA, explicacao, opt-out ou "responda SAIR". Apenas a confirmacao, com 1 pergunta so.\n` +
    `Estilo desta vez: "${estilo}". Varie levemente a redacao mantendo o sentido.\n` +
    `IDIOMA: portugues do Brasil PERFEITO (acentuacao, cedilha, pontuacao). Jamais escreva sem acento. ` +
    `NUNCA use travessao (o caractere "—"); use virgula ou ponto. Linguagem natural e humana, nada robotizado.\n` +
    `Responda APENAS com o texto da mensagem, sem aspas e sem explicacao.`;
  const user = `Lead: nome=${lead.nome || '-'}, empreendimento=${lead.empreendimentoInteresse || '-'}. Escreva SO a confirmacao de interesse (1 pergunta).`;
  try {
    const resp = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 120,
      temperature: 0.9,
      system: sys,
      messages: [{ role: 'user', content: user }],
    });
    let t = resp.content?.map((b) => b.text || '').join('').trim() || '';
    t = semTravessao(limparOptOut(t.replace(/^["'`]+|["'`]+$/g, '').trim()));
    return t || aberturaFallback(lead, estilo);
  } catch (e) {
    logApiError('gerarPrimeiroContato', e);
    return aberturaFallback(lead, estilo);
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
  // Normaliza o historico: alternancia user/assistant, terminando em USER
  // (o modelo NAO suporta prefill de assistant; a conversa precisa terminar no usuario).
  const messages = normalizeHistory(lead.history);

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
    const text = resp.content?.map((b) => b.text || '').join('') || '';
    rawForLog = text;
    parsed = extractJSON(text); // extrai o JSON de dentro do texto (sem prefill)
    if (resp.stop_reason === 'max_tokens') console.warn('[agent] resposta truncada (max_tokens).');
  } catch (e) {
    logApiError('runAgent', e);
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
