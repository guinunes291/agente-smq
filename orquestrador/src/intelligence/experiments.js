// Registro de experimentos (hipotese -> experimento -> resultado), human-in-loop.
// O sistema PROPOE; a promocao a producao e SEMPRE acao humana (gestor), que
// versiona o prompt/script. Nada e auto-promovido (dominio de credito regulado).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.EXPERIMENTS_DIR || path.resolve(__dirname, '..', '..', 'data', 'experiments');
const FILE = path.join(DIR, 'experiments.jsonl');

const STATUS = ['proposto', 'aprovado', 'rejeitado', 'promovido'];

function ler() {
  try {
    return fs.readFileSync(FILE, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
function gravar(linhas) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

/** Propoe um experimento (status inicial: proposto). Volta o id. */
export function propor(hipotese = {}) {
  const linhas = ler();
  const id = `exp_${Date.now().toString(36)}_${linhas.length}`;
  linhas.push({ id, status: 'proposto', criadoEm: new Date().toISOString(), ...hipotese });
  gravar(linhas);
  return id;
}

/** Acao HUMANA: aprova/rejeita/promove um experimento. */
export function revisar(id, status, revisor = 'gestor') {
  if (!STATUS.includes(status)) throw new Error(`status invalido: ${status}`);
  const linhas = ler();
  const exp = linhas.find((l) => l.id === id);
  if (!exp) return null;
  exp.status = status;
  exp.revisadoPor = revisor;
  exp.revisadoEm = new Date().toISOString();
  gravar(linhas);
  return exp;
}

export function listar(status) {
  const linhas = ler();
  return status ? linhas.filter((l) => l.status === status) : linhas;
}

export const _FILE = FILE;
