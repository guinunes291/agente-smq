import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-repo-'));
process.env.MEM_DIR = path.join(TMP, 'memory');
process.env.DATA_BACKEND = 'file';

const { FileRepository } = await import('./repository.js');
const { getLead, saveLead } = await import('../state.js');

describe('FileRepository', () => {
  it('mescla e le memoria curada', () => {
    const repo = new FileRepository();
    repo.mergeMemory('5511999990000', { objetivo: 'morar', faixaRenda: '3000' });
    const m = repo.getMemory('5511999990000');
    expect(m.objetivo).toBe('morar');
  });

  it('forget apaga estado e memoria do lead (LGPD)', async () => {
    const phone = '5511888887777';
    const lead = getLead(phone);
    lead.nome = 'Fulano';
    saveLead(lead);
    const repo = new FileRepository();
    repo.mergeMemory(phone, { objetivo: 'investir' });

    const r = await repo.forget(phone);
    expect(r.state).toBe(true);
    expect(r.memory).toBe(true);
    // memoria foi removida -> get volta vazio
    expect(repo.getMemory(phone)).toEqual({});
  });

  it('getOutcome sem CRM retorna null', async () => {
    const repo = new FileRepository();
    expect(await repo.getOutcome({ phone: 'x' })).toBeNull();
  });
});
