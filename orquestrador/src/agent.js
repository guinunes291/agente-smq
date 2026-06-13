// Cerebro do agente: monta o prompt, chama a Anthropic e devolve o JSON de acao.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { contextoConhecimento } from './tools.js';

const client = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

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
  "acoes": [ {"tool":"SALVAR_LEAD","args":{"nome":"...","objetivo":"...","faixaRenda":"...","regiao":"...","empreendimentoInteresse":"...","temperatura":"...","estagio":"..."}} ],
  "temperatura": "FRIO|MORNO|QUENTE|PRONTO",
  "estagio": "primeiro_contato|qualificando|oferta_visita|oferta_analise|handoff|encerrado",
  "handoff": false
}
Regras do JSON:
- Sempre inclua uma acao SALVAR_LEAD com os campos que voce conseguiu inferir nesta mensagem.
- Se o cliente ACEITOU a analise de credito OU confirmou visita OU pediu humano: inclua {"tool":"HANDOFF","args":{"motivo":"analise|visita|humano","resumo":"..."}} e "handoff": true.
- Se o cliente pediu para parar (SAIR/PARAR): inclua {"tool":"OPT_OUT"} e encerre.
- Nao invente valores/plantas que nao estejam nos empreendimentos acima.`;

  const guia = guiaConversa ? `\n\n=== GUIA DE CONVERSA SMQ (siga este estilo) ===\n${guiaConversa}` : '';
  return systemPrompt + guia + injected;
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
