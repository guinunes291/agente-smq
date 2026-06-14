// Memoria Comercial — repositorio plugavel.
// MVP: FileMemoryRepository (JSON em data/memory/<phone>.json), guardando apenas
// campos UTEIS e curados (sem poluir, alinhado a LGPD/minimo necessario).
// Futuro: CrmMemoryRepository (grava no CRM via API) — interface identica.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEM_DIR = process.env.MEM_DIR || path.resolve(__dirname, '..', '..', 'data', 'memory');

// Allowlist de campos que valem a pena memorizar (evita poluicao e PII desnecessaria).
export const CAMPOS_MEMORIA = [
  'objetivo',
  'faixaRenda',
  'regiao',
  'empreendimentoInteresse',
  'produtoIdeal',
  'temperatura',
  'estagio',
  'usaFgts',
  'entradaDisponivel',
  'objecoesVistas',
  'aprendizados',
];

function sanitizePhone(phone) {
  return String(phone || 'desconhecido').replace(/[^\d]/g, '') || 'desconhecido';
}

/**
 * Contrato do repositorio de memoria.
 * @typedef {Object} MemoryRepository
 * @property {(phone:string)=>object} get
 * @property {(phone:string, patch:object)=>object} merge
 */

/** @implements {MemoryRepository} */
export class FileMemoryRepository {
  constructor(dir = MEM_DIR) {
    this.dir = dir;
  }

  _file(phone) {
    return path.join(this.dir, `${sanitizePhone(phone)}.json`);
  }

  get(phone) {
    try {
      return JSON.parse(fs.readFileSync(this._file(phone), 'utf8'));
    } catch {
      return {};
    }
  }

  // Mescla apenas campos da allowlist; acumula listas (objecoesVistas/aprendizados) sem duplicar.
  merge(phone, patch = {}) {
    const cur = this.get(phone);
    for (const k of CAMPOS_MEMORIA) {
      const v = patch[k];
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) {
        const set = new Set([...(cur[k] || []), ...v]);
        cur[k] = [...set];
      } else {
        cur[k] = v;
      }
    }
    cur.updatedAt = Date.now();
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this._file(phone), JSON.stringify(cur, null, 2));
    } catch (e) {
      console.error('[memory] erro ao persistir', e.message);
    }
    return cur;
  }
}

/**
 * Stub do repositorio no CRM (fase Estavel): mesma interface, grava via API.
 * Hoje delega para o arquivo local para nao bloquear o MVP.
 * @implements {MemoryRepository}
 */
export class CrmMemoryRepository {
  constructor(opts = {}) {
    this.fallback = new FileMemoryRepository(opts.dir);
    // TODO(fase Estavel): receber { baseUrl, token } e gravar/ler via endpoint do CRM.
  }
  get(phone) {
    return this.fallback.get(phone);
  }
  merge(phone, patch) {
    return this.fallback.merge(phone, patch);
  }
}

// Instancia padrao usada pelo orquestrador.
export const memoryRepo = new FileMemoryRepository();
