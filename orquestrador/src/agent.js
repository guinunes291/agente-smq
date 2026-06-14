// Geracao da mensagem de PRIMEIRO contato (abertura), variando por lead.
// O "cerebro" de conducao da conversa foi modularizado em agents/ (Orquestrador +
// Qualificador + especialistas). Este arquivo cuida so da abertura proativa.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { loadKnowledge } from './knowledge.js';

const client = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

// Variacoes de fallback (usadas se a API falhar ou em teste local) - ja variam o gancho.
const ABERTURAS_FALLBACK = [
  (l) => `Oi ${l.nome || ''}! Aqui e o time da Seu Metro Quadrado 👋 Vi seu interesse${l.empreendimentoInteresse ? ` no ${l.empreendimentoInteresse}` : ''}. Quer que eu veja a melhor opcao pro seu perfil e ja adiante sua analise? Se preferir nao receber, responda SAIR.`,
  (l) => `Oi ${l.nome || ''}, tudo bem? Time da Seu Metro Quadrado aqui. Com a sua renda da pra usar o subsidio do MCMV e ter parcela parecida com aluguel. Posso te mostrar como fica no seu caso? (se nao quiser, responda SAIR)`,
  (l) => `Fala ${l.nome || ''}! Aqui e o time da Seu Metro Quadrado. Vi que voce quer conquistar seu imovel${l.empreendimentoInteresse ? ` (${l.empreendimentoInteresse})` : ''}. Bora ver as condicoes e ja adiantar sua analise? Pra parar de receber, e so responder SAIR.`,
];
export function aberturaFallback(lead) {
  const f = ABERTURAS_FALLBACK[Math.floor(Math.random() * ABERTURAS_FALLBACK.length)];
  return f(lead);
}

// Gera UMA mensagem de primeiro contato, variando a cada lead (para a IA "aprender" o que converte).
export async function gerarPrimeiroContato(lead) {
  if (!client) return aberturaFallback(lead);
  const { guiaConversa } = loadKnowledge();
  const sys =
    `Voce e o assistente comercial da Seu Metro Quadrado (imobiliaria MCMV). ` +
    `Escreva UMA mensagem de PRIMEIRO contato no WhatsApp para um lead.\n` +
    `Regras: maximo 4 linhas; comece com o nome; use um gancho especifico (empreendimento, objetivo, sair do aluguel, ou subsidio); ` +
    `tom humano, caloroso e simples; UMA pergunta com CTA leve (ver opcoes ou adiantar a analise); ` +
    `termine oferecendo opt-out de forma discreta (ex.: "se nao quiser, responda SAIR"); ` +
    `NAO use colchetes/placeholder; NAO prometa aprovacao; VARIE o estilo, o gancho e a abertura a cada vez (nao repita formula fixa).\n` +
    `Responda APENAS com o texto da mensagem, sem aspas e sem explicacao.\n\n` +
    `Resumo de estilo SMQ:\n${(guiaConversa || '').slice(0, 1500)}`;
  const user = `Lead: nome=${lead.nome || '-'}, empreendimento=${lead.empreendimentoInteresse || '-'}, objetivo=${lead.objetivo || '-'}, faixaRenda=${lead.faixaRenda || '-'}. Escreva a mensagem de primeiro contato.`;
  try {
    const resp = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 220,
      temperature: 0.9,
      system: sys,
      messages: [{ role: 'user', content: user }],
    });
    let t = resp.content?.map((b) => b.text || '').join('').trim() || '';
    t = t.replace(/^["'`]+|["'`]+$/g, '').trim();
    return t || aberturaFallback(lead);
  } catch (e) {
    console.error('[agent] gerarPrimeiroContato falhou:', e.message);
    return aberturaFallback(lead);
  }
}
