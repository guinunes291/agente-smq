// Cerebro do agente: monta o prompt, chama a Anthropic e devolve o JSON de acao.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { contextoConhecimento } from './tools.js';

const client = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

function buildSystem(lead) {
  const { systemPrompt } = loadKnowledge();
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

  return systemPrompt + injected;
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
  const messages = lead.history.map((h) => ({ role: h.role, content: h.content }));

  const resp = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 700,
    system,
    messages,
  });

  const text = resp.content?.map((b) => b.text || '').join('') || '';
  const parsed = extractJSON(text);
  if (!parsed) {
    console.error('[agent] JSON invalido. Texto bruto:', text.slice(0, 300));
    return {
      mensagem_cliente: 'Me conta um pouco mais pra eu te ajudar certinho: voce busca pra morar ou pra investir?',
      acoes: [],
      temperatura: lead.temperatura,
      estagio: lead.estagio,
      handoff: false,
    };
  }
  return parsed;
}
