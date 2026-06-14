// Teste de PONTA A PONTA do agente de qualificacao (sem chamar a API real).
// Injeta um "cerebro" roteirizado e simula uma conversa completa:
//   intake (abertura) -> qualificacao -> aceite da analise -> HANDOFF.
// Tambem valida: grupo ignorado, desconhecido ignorado, anti-loop.
import { setClientForTest, gerarPrimeiroContato } from './agent.js';
import { handleInbound } from './processor.js';
import { getLead, saveLead, pushHistory } from './state.js';

// ---- Cerebro FALSO (roteiro de qualificacao) ----
const fila = [
  // Q1: pergunta renda
  { mensagem_cliente: 'Que bom, Andrew! Sair do aluguel e um baita passo. Quanto voces recebem juntos por mes, mais ou menos?',
    acoes: [{ tool: 'SALVAR_LEAD', args: { objetivo: 'morar', temperatura: 'MORNO', estagio: 'qualificando' } }],
    temperatura: 'MORNO', estagio: 'qualificando', handoff: false },
  // Q2: enfatiza analise
  { mensagem_cliente: 'Show! Com ~3 mil da pra usar o subsidio do MCMV. O passo que confirma tudo e a analise de credito, rapida e sem compromisso. Posso ja adiantar a sua?',
    acoes: [{ tool: 'SALVAR_LEAD', args: { faixaRenda: '~3000', temperatura: 'QUENTE', estagio: 'oferta_analise' } }],
    temperatura: 'QUENTE', estagio: 'oferta_analise', handoff: false },
  // Q3: aceite -> HANDOFF
  { mensagem_cliente: 'Perfeito! Ja estou te conectando com o corretor responsavel, que cuida da sua analise. Te chama em instantes!',
    acoes: [{ tool: 'HANDOFF', args: { motivo: 'analise', resumo: 'Aceitou analise; morar; renda ~3k' } }],
    temperatura: 'PRONTO', estagio: 'handoff', handoff: true },
];
let i = 0;
const fakeClient = {
  messages: {
    create: async (params) => {
      const last = params.messages[params.messages.length - 1];
      const ehQualificacao = last && last.role === 'assistant' && last.content === '{';
      if (ehQualificacao) {
        const obj = fila[Math.min(i, fila.length - 1)]; i++;
        const cont = JSON.stringify(obj).slice(1); // remove '{' (o runAgent faz o prefill)
        return { content: [{ type: 'text', text: cont }], stop_reason: 'end_turn' };
      }
      // abertura (gerarPrimeiroContato) -> texto puro
      return { content: [{ type: 'text', text: 'Oi Andrew! Vi que voce quer sair do aluguel e conquistar seu ape. Posso te mostrar as opcoes e ja adiantar sua analise? (responda SAIR pra nao receber)' }], stop_reason: 'end_turn' };
    },
  },
};

function assert(cond, msg) {
  console.log((cond ? 'PASS' : 'FALHOU') + ' - ' + msg);
  if (!cond) process.exitCode = 1;
}

async function main() {
  setClientForTest(fakeClient);
  const sent = [];
  const sender = async (to, body) => { sent.push(body); };
  const phone = '5511999998888';

  console.log('== E2E: agente de qualificacao ==\n');

  // 1) INTAKE: abertura gerada + marca como gerenciado (simula /intake/new-lead)
  const lead = getLead(phone);
  lead.history = []; lead.agentManaged = true; lead.paused = false; lead.handoff = false;
  lead.nome = 'Andrew'; lead.empreendimentoInteresse = 'Vibra Sabara';
  const abertura = await gerarPrimeiroContato(lead);
  pushHistory(lead, 'assistant', abertura); saveLead(lead);
  console.log('Abertura:', abertura);
  assert(!!abertura && abertura.length > 20, '1) abertura gerada');

  // 2) Lead responde -> agente pergunta renda
  const r1 = await handleInbound({ channel: 'zapi', from: phone, text: 'e pra morar, to de aluguel' }, { sender });
  console.log('Agente:', r1.sent);
  assert(!!r1.sent && lead.estagio === 'qualificando', '2) agente qualifica (pergunta renda)');

  // 3) Lead informa renda -> agente enfatiza analise
  const r2 = await handleInbound({ channel: 'zapi', from: phone, text: 'ganho uns 3 mil' }, { sender });
  console.log('Agente:', r2.sent);
  assert(!!r2.sent && lead.estagio === 'oferta_analise', '3) agente enfatiza analise');

  // 4) Lead aceita analise -> HANDOFF
  const r3 = await handleInbound({ channel: 'zapi', from: phone, text: 'pode fazer a analise' }, { sender });
  console.log('Agente:', r3.sent);
  assert(r3.handoff === true && lead.handoff === true, '4) aceite -> HANDOFF disparado');

  // 5) Pos-handoff: agente NAO reconduz
  const r4 = await handleInbound({ channel: 'zapi', from: phone, text: 'e ai, novidades?' }, { sender });
  assert(r4.handoffAtivo === true && !r4.sent, '5) pos-handoff: agente nao responde mais');

  // 6) Grupo ignorado
  const g = await handleInbound({ channel: 'zapi', from: '5511000000000', text: 'oi', isGroup: true }, { sender });
  assert(g.ignored === 'group', '6) grupo ignorado');

  // 7) Desconhecido (nao gerenciado) ignorado
  const d = await handleInbound({ channel: 'zapi', from: '5511222223333', text: 'bom dia' }, { sender });
  assert(d.ignored === 'nao_e_lead', '7) desconhecido ignorado');

  console.log('\nMensagens enviadas ao lead:', sent.length, '(esperado 3: Q1, Q2, Q3)');
  assert(sent.length === 3, '8) total de respostas ao lead = 3');

  console.log('\n== FIM ==');
}

main().catch((e) => { console.error('ERRO NO E2E:', e); process.exit(1); });
