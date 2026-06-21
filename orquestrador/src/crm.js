// CRM simples: grava/atualiza leads num CSV. Em producao, troque por HubSpot/RD/DB.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CRM = path.resolve(__dirname, '..', 'data', 'leads.csv');
const HEADERS = [
  'timestamp', 'telefone', 'nome', 'origem', 'objetivo', 'faixaRenda',
  'regiao', 'empreendimentoInteresse', 'temperatura', 'estagio',
  'corretorDestino', 'optIn', 'optOut', 'aberturaVariante', 'respondeu', 'resumo',
];

function ensure() {
  if (!fs.existsSync(CRM)) {
    fs.mkdirSync(path.dirname(CRM), { recursive: true });
    fs.writeFileSync(CRM, HEADERS.join(',') + '\n');
  }
}

function esc(v) {
  const s = (v ?? '').toString().replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function upsertLeadCRM(lead, { corretorDestino = '', resumo = '' } = {}) {
  ensure();
  // respondeu = o lead mandou pelo menos 1 mensagem depois da abertura (metrica de taxa de resposta)
  const respondeu = (lead.history || []).some((h) => h.role === 'user') ? 'sim' : 'nao';
  const row = [
    new Date().toISOString(), lead.phone, lead.nome, lead.origem, lead.objetivo,
    lead.faixaRenda, lead.regiao, lead.empreendimentoInteresse, lead.temperatura,
    lead.estagio, corretorDestino, lead.optIn, lead.optOut,
    lead.aberturaVariante || '', respondeu, resumo,
  ].map(esc).join(',');
  fs.appendFileSync(CRM, row + '\n');
}
