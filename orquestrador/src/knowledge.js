// Carrega a base de conhecimento (CSVs + textos) que fica em 02-BASE-CONHECIMENTO.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Permite sobrescrever via env (util em deploy/Docker). Default: pastas do projeto.
const KB_DIR = process.env.KB_DIR || path.resolve(__dirname, '..', '..', '02-BASE-CONHECIMENTO');
const CTX_DIR = process.env.CTX_DIR || path.resolve(__dirname, '..', '..', '01-CONTEXTO-AGENTE');

// --- Parser CSV simples (suporta campos sem virgulas internas; bom para nossos schemas) ---
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = (cols[i] ?? '').trim()));
    return row;
  });
}

function splitCsvLine(line) {
  // suporta aspas duplas para campos com virgula
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

let _cache = null;

export function loadKnowledge(force = false) {
  if (_cache && !force) return _cache;
  const empreendimentos = parseCSV(readSafe(path.join(KB_DIR, 'empreendimentos.csv')));
  const corretores = parseCSV(readSafe(path.join(KB_DIR, 'corretores.csv')));
  const regrasMcmv = readSafe(path.join(KB_DIR, 'regras-mcmv-2026.md'));
  const faq = readSafe(path.join(KB_DIR, 'faq.md'));
  const systemPrompt = readSafe(path.join(CTX_DIR, 'system-prompt.md'));
  const guiaConversa = readSafe(path.join(CTX_DIR, 'guia-conversa-smq.md'));
  _cache = { empreendimentos, corretores, regrasMcmv, faq, systemPrompt, guiaConversa };
  return _cache;
}

// Match simples produto<->lead. Pode ser refinado conforme a operacao.
export function buscarEmpreendimentos({ regiao, objetivo, perfil, faixaPreco } = {}) {
  const { empreendimentos } = loadKnowledge();
  const norm = (s) => (s || '').toLowerCase();
  let res = empreendimentos.filter((e) => !norm(e.nome).includes('[preencher]'));

  if (objetivo) {
    const inv = /invest/.test(norm(objetivo));
    res = res.filter((e) => (inv ? /invest/.test(norm(e.tipo_produto) + norm(e.perfil_cliente)) : !/invest/.test(norm(e.tipo_produto))));
  }
  if (regiao) res = res.filter((e) => norm(e.regiao).includes(norm(regiao)) || norm(e.bairro).includes(norm(regiao)));
  if (faixaPreco) res = res.filter((e) => !e.preco_por || Number(e.preco_por) <= Number(faixaPreco) * 1.1);

  // se filtrou demais, devolve algo do mesmo objetivo para nao "descartar"
  if (!res.length && objetivo) {
    const inv = /invest/.test(norm(objetivo));
    res = empreendimentos.filter((e) => (inv ? /invest/.test(norm(e.tipo_produto)) : !/invest/.test(norm(e.tipo_produto))) && !norm(e.nome).includes('[preencher]'));
  }
  return res.slice(0, 3);
}

// Retorna TODOS os corretores candidatos (para a roleta), em ordem estavel.
export function buscarCorretores({ empreendimentoId, regiao } = {}) {
  const { corretores } = loadKnowledge();
  const norm = (s) => (s || '').toLowerCase();
  const ativos = corretores.filter((x) => norm(x.ativo) === 'sim');

  let cands = [];
  if (empreendimentoId) {
    cands = ativos.filter((x) => (x.projetos_responsaveis || '').split(';').map((s) => s.trim()).includes(empreendimentoId));
  }
  if (!cands.length && regiao) {
    cands = ativos.filter((x) => norm(x.regioes).includes(norm(regiao)));
  }
  if (!cands.length) cands = ativos; // fallback: roleta global entre ativos
  return cands;
}

// Compatibilidade: 1 corretor (sem roleta). Prefira buscarCorretores + roleta.
export function buscarCorretor(args = {}) {
  return buscarCorretores(args)[0] || null;
}
