// Processa uma mensagem recebida (de qualquer canal) ponta a ponta.
import { getLead, saveLead, pushHistory } from './state.js';
import { isOptOutMessage, rateLimitOk, humanDelay, sleep } from './guards.js';
import { orchestrate } from './agents/orchestrator.js';
import { executarAcao, optOut } from './tools.js';
import { buscarLeadCadastrado } from './crm-integration.js';
import { sendText } from './whatsapp/send.js';

// inbound = { channel, from, name, text, ts, isGroup }
export async function handleInbound(inbound, { sender = sendText } = {}) {
  // 0a) NUNCA responder grupo
  if (inbound.isGroup) return { ignored: 'group' };

  const lead = getLead(inbound.from);

  // 0c) Lead PAUSADO manualmente -> nunca responde (override total)
  if (lead.paused) {
    lead.lastInboundTs = inbound.ts || Date.now();
    saveLead(lead);
    return { ignored: 'pausado' };
  }

  // 0b) Responder apenas LEADS: (a) iniciados pelo agente OU (b) cadastrados no forms/CRM.
  //     Conversa antiga / contato que nao e lead = IGNORADO (nao responde).
  if (!lead.agentManaged) {
    // tenta casar o telefone com um cadastro do forms/CRM
    const cadastro = await buscarLeadCadastrado(inbound.from);
    if (cadastro) {
      lead.agentManaged = true; // e um lead real -> pode responder
      lead.origem = lead.origem || 'forms_crm';
      if (cadastro.nome && !lead.nome) lead.nome = cadastro.nome;
      if (cadastro.id && !lead.crmLeadId) lead.crmLeadId = cadastro.id;
      console.log(`[processor] inbound de lead CADASTRADO (${inbound.from}) -> respondendo`);
    } else {
      console.log(`[processor] ignorado (nao e lead cadastrado nem iniciado pelo agente): ${inbound.from}`);
      lead.lastInboundTs = inbound.ts || Date.now();
      saveLead(lead);
      return { ignored: 'nao_e_lead' };
    }
  }

  lead.lastInboundTs = inbound.ts || Date.now();
  if (inbound.name && !lead.nome) lead.nome = inbound.name;
  if (inbound.channel && !lead.origem) lead.origem = `whatsapp:${inbound.channel}`;

  // 1) opt-out tem prioridade absoluta
  if (isOptOutMessage(inbound.text)) {
    optOut(lead);
    const msg = `Prontinho${lead.nome ? ', ' + lead.nome : ''}! Nao te envio mais nada. Se mudar de ideia, e so chamar. 🙏`;
    await sender(inbound.from, msg, inbound.channel);
    return { sent: msg, optOut: true };
  }

  // 2) ja em handoff: agente nao reconduz a venda
  if (lead.handoff) {
    pushHistory(lead, 'user', inbound.text);
    saveLead(lead);
    return { sent: null, handoffAtivo: true };
  }

  // 3) registra a mensagem do cliente
  pushHistory(lead, 'user', inbound.text);

  // 4) cerebro decide (Orquestrador: especialistas + Qualificador + Compliance)
  const decision = await orchestrate(lead, inbound);

  // 5) aplica campos/estado
  if (decision.temperatura) lead.temperatura = decision.temperatura;
  if (decision.estagio) lead.estagio = decision.estagio;
  if (['oferta_analise', 'oferta_visita'].includes(decision.estagio)) lead.convitesAnaliseVisita += 1;

  const msg = (decision.mensagem_cliente || '').trim();

  // mensagem da ultima resposta do agente (para travar repeticao)
  const ultimaDoAgente = [...lead.history].reverse().find((h) => h.role === 'assistant')?.content?.trim() || '';

  // 6) executa as acoes pedidas (SALVAR_LEAD, AGENDAR, HANDOFF, OPT_OUT)
  for (const acao of decision.acoes || []) {
    await executarAcao(lead, acao);
  }

  // 5b) NAO enviar se: vazio (parse falhou) OU identico a ultima resposta (anti-loop)
  if (!msg) {
    saveLead(lead);
    console.warn(`[processor] sem mensagem para enviar (parseFailed=${!!decision.parseFailed}) - ${lead.phone}`);
    return { sent: null, semMensagem: true };
  }
  if (msg === ultimaDoAgente) {
    saveLead(lead);
    console.warn(`[processor] mensagem identica a anterior - nao reenviada (anti-loop) - ${lead.phone}`);
    return { sent: null, duplicada: true };
  }

  pushHistory(lead, 'assistant', msg);
  saveLead(lead);

  // 7) rate-limit (anti-spam): se estourou o teto diario, nao envia
  if (!rateLimitOk(lead)) {
    console.warn(`[processor] rate limit atingido para ${lead.phone}, mensagem nao enviada.`);
    return { sent: null, rateLimited: true };
  }

  // 8) atraso humano + envio
  await sleep(humanDelay());
  await sender(inbound.from, msg, inbound.channel);
  lead.sentToday = lead.sentToday || [];
  lead.sentToday.push(Date.now());
  saveLead(lead);

  return { sent: msg, handoff: !!decision.handoff, estagio: lead.estagio, temperatura: lead.temperatura };
}
