import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withRetry, ehTransiente } from './retry.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-dl-'));
process.env.DEADLETTER_DIR = TMP;
const { registrarFalha, listarFalhas } = await import('./deadletter.js');

describe('retry', () => {
  it('classifica erros transientes vs definitivos', () => {
    expect(ehTransiente({ status: 529 })).toBe(true);
    expect(ehTransiente({ status: 503 })).toBe(true);
    expect(ehTransiente({ code: 'ECONNRESET' })).toBe(true);
    expect(ehTransiente({ status: 400 })).toBe(false);
    expect(ehTransiente({ status: 401 })).toBe(false);
  });

  it('reentrega em erro transiente e acaba dando certo', async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw { status: 529 };
        return 'ok';
      },
      { tentativas: 3, baseMs: 1 },
    );
    expect(r).toBe('ok');
    expect(n).toBe(3);
  });

  it('NAO reentrega erro definitivo (4xx)', async () => {
    let n = 0;
    await expect(
      withRetry(async () => {
        n += 1;
        throw { status: 400, message: 'bad' };
      }, { tentativas: 3, baseMs: 1 }),
    ).rejects.toBeTruthy();
    expect(n).toBe(1);
  });

  it('propaga o erro apos esgotar as tentativas', async () => {
    let n = 0;
    await expect(
      withRetry(async () => {
        n += 1;
        throw { status: 503 };
      }, { tentativas: 2, baseMs: 1 }),
    ).rejects.toBeTruthy();
    expect(n).toBe(2);
  });
});

describe('deadletter', () => {
  it('registra falha sem expor PII alem do necessario p/ reenvio', () => {
    const rec = registrarFalha({ inbound: { from: '5511999990000', text: 'oi', channel: 'zapi' }, fase: 'envio', erro: 'timeout' });
    expect(rec.phoneHash).toMatch(/^ph_/);
    expect(rec.text).toBe('oi');
    const todas = listarFalhas();
    expect(todas.length).toBeGreaterThanOrEqual(1);
    expect(todas[todas.length - 1].fase).toBe('envio');
  });
});
