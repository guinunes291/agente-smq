import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-metrics-'));
process.env.METRICS_DIR = TMP;

const { registrarScript, agregarPorVariante, varianteId, _FILE } = await import('./scriptMetrics.js');

describe('scriptMetrics', () => {
  beforeEach(() => {
    try { fs.unlinkSync(_FILE); } catch {}
  });

  it('gera o mesmo id para o mesmo texto', () => {
    expect(varianteId('Olá, tudo bem?')).toBe(varianteId('Olá, tudo bem?'));
  });

  it('agrega taxa de resposta e handoff por variante', () => {
    const v = 'abertura A';
    registrarScript({ tipo: 'primeiro_contato', variante: v, evento: 'enviado' });
    registrarScript({ tipo: 'primeiro_contato', variante: v, evento: 'enviado' });
    registrarScript({ tipo: 'primeiro_contato', variante: v, evento: 'respondido' });
    registrarScript({ tipo: 'primeiro_contato', variante: v, evento: 'handoff' });
    const agg = agregarPorVariante();
    const id = varianteId(v);
    expect(agg[id].enviados).toBe(2);
    expect(agg[id].taxaResposta).toBe(0.5);
    expect(agg[id].taxaHandoff).toBe(0.5);
  });
});
