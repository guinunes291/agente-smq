// Repository durável: abstrai memoria, eventos, desfecho (outcome), persistencia
// de conversa e erasure (LGPD). Seleciona o backend por env DATA_BACKEND=file|crm.
//   - FileRepository: backend atual (arquivos locais) — fallback/dev.
//   - CrmRepository : persiste no CRM (TiDB) via HTTP, liga conversa->desfecho.
// Mantem a MESMA interface, para trocar o backend sem mexer nos agentes.
import axios from 'axios';
import { config } from '../config.js';
import { memoryRepo, FileMemoryRepository } from '../memory/repository.js';
import { deleteLead } from '../state.js';
import { setEventSink } from '../telemetry/events.js';

/**
 * @typedef {Object} Repository
 * @property {(phone:string)=>object} getMemory
 * @property {(phone:string, patch:object)=>object} mergeMemory
 * @property {(event:object)=>void} emitEvent
 * @property {(args:{leadId?:string|number, phone?:string})=>Promise<object|null>} getOutcome
 * @property {(conv:object)=>Promise<object|null>} saveConversation
 * @property {(phone:string)=>Promise<{state:boolean, memory:boolean}>} forget
 */

/** @implements {Repository} */
export class FileRepository {
  constructor(mem = memoryRepo) {
    this.mem = mem;
  }
  getMemory(phone) {
    return this.mem.get(phone);
  }
  mergeMemory(phone, patch) {
    return this.mem.merge(phone, patch);
  }
  emitEvent() {
    /* file sink ja e o default do telemetry */
  }
  async getOutcome() {
    return null; // sem CRM, nao ha rotulo de desfecho
  }
  async saveConversation() {
    return null;
  }
  async forget(phone) {
    const state = deleteLead(phone);
    const memory = this.mem.delete ? this.mem.delete(phone) : false;
    return { state, memory };
  }
}

/** @implements {Repository} */
export class CrmRepository {
  constructor({ baseUrl, token } = {}) {
    this.baseUrl = baseUrl || config.crm.baseUrl;
    // token dedicado dos endpoints /api/agent/* (nao e o token de campanha)
    this.token = token || config.crm.agentToken;
    this.mem = new FileMemoryRepository(); // cache local; fonte de verdade e o CRM
  }
  _url(p) {
    return `${this.baseUrl}/api/agent/${p}?token=${encodeURIComponent(this.token)}`;
  }
  getMemory(phone) {
    return this.mem.get(phone);
  }
  mergeMemory(phone, patch) {
    const merged = this.mem.merge(phone, patch);
    // best-effort: replica no CRM (nao bloqueia o turno)
    this.emitEvent({ agent: 'memoria', type: 'merge', phoneHash: patch.phoneHash, meta: { campos: Object.keys(patch) } });
    return merged;
  }
  emitEvent(event) {
    axios.post(this._url('events'), { events: [event] }, { timeout: 6000 }).catch((e) => {
      console.error('[CrmRepository] events falhou:', e.response?.status || e.message);
    });
  }
  async getOutcome({ leadId, phone } = {}) {
    try {
      const { data } = await axios.get(this._url('outcome'), { params: { leadId, telefone: phone }, timeout: 6000 });
      return data || null;
    } catch (e) {
      console.error('[CrmRepository] outcome falhou:', e.response?.status || e.message);
      return null;
    }
  }
  async saveConversation(conv) {
    try {
      const { data } = await axios.post(this._url('conversation'), conv, { timeout: 8000 });
      return data || null;
    } catch (e) {
      console.error('[CrmRepository] saveConversation falhou:', e.response?.status || e.message);
      return null;
    }
  }
  async forget(phone) {
    const state = deleteLead(phone);
    const memory = this.mem.delete ? this.mem.delete(phone) : false;
    // TODO(fase Estavel): chamar erasure no CRM (DELETE /api/agent/lead).
    return { state, memory };
  }
}

let _repo = null;

/** Seleciona o backend por env (DATA_BACKEND=crm usa o CRM; default=file). */
export function getRepository() {
  if (_repo) return _repo;
  const backend = (process.env.DATA_BACKEND || 'file').toLowerCase();
  if (backend === 'crm' && config.crm.agentToken) {
    _repo = new CrmRepository();
    setEventSink((event) => _repo.emitEvent(event)); // telemetria vai ao CRM
    console.log('[repository] backend = CRM (TiDB)');
  } else {
    _repo = new FileRepository();
    console.log('[repository] backend = file');
  }
  return _repo;
}

// Util para testes: reseta o singleton.
export function _resetRepository() {
  _repo = null;
}
