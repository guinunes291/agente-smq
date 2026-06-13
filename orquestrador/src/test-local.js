// Teste local SEM credenciais: usa o stub do agente e um "sender" mock.
// Valida: carregamento da base, fluxo de processamento, opt-out e handoff manual.
import { handleInbound } from './processor.js';
import { handoff } from './tools.js';
import { getLead } from './state.js';
import { buscarEmpreendimentos, buscarCorretor, loadKnowledge } from './knowledge.js';

const sent = [];
const mockSender = async (to, body, channel) => {
  sent.push({ to, body, channel });
  console.log(`\n>>> ENVIADO p/ ${to} [${channel}]:\n${body}`);
};

async function main() {
  console.log('== 1) Base de conhecimento ==');
  const kb = loadKnowledge();
  console.log('Empreendimentos carregados:', kb.empreendimentos.length);
  console.log('Corretores carregados:', kb.corretores.length);
  console.log('Match (morar/Zona Oeste):', buscarEmpreendimentos({ objetivo: 'morar', regiao: 'Zona Oeste' }).map((e) => e.nome));
  console.log('Match (investir):', buscarEmpreendimentos({ objetivo: 'investir' }).map((e) => e.nome));
  console.log('Corretor p/ EMP002:', buscarCorretor({ empreendimentoId: 'EMP002' })?.id);

  console.log('\n== 2) Conversa simulada (stub do agente) ==');
  const phone = '5511999990000';
  await handleInbound({ channel: 'meta', from: phone, name: 'Leeh Teste', text: 'oi, vi o anuncio', ts: Date.now() }, { sender: mockSender });
  await handleInbound({ channel: 'meta', from: phone, text: 'quero pra morar, zona oeste', ts: Date.now() }, { sender: mockSender });

  console.log('\n== 3) Handoff manual (regra: aceitou analise) ==');
  const lead = getLead(phone);
  lead.objetivo = 'morar'; lead.regiao = 'Zona Oeste'; lead.empreendimentoInteresse = 'Nova Leopoldina'; lead.temperatura = 'QUENTE';
  const r = await handoff(lead, { motivo: 'analise', resumo: 'Aceitou analise; 2 dorms Zona Oeste; tem FGTS', empreendimentoId: 'EMP002' });
  console.log('Handoff ->', r);

  console.log('\n== 4) Opt-out ==');
  await handleInbound({ channel: 'meta', from: '5511888880000', text: 'PARAR', ts: Date.now() }, { sender: mockSender });

  console.log(`\n== OK: ${sent.length} mensagens "enviadas" no mock. Fluxo executou sem erros. ==`);
}

main().catch((e) => { console.error('FALHA NO TESTE:', e); process.exit(1); });
