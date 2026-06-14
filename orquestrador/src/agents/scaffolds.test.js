import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isola metricas/logs em tmp antes de importar.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-scaffold-'));
process.env.METRICS_DIR = path.join(TMP, 'metrics');
process.env.LOG_DIR = path.join(TMP, 'logs');

const { registrarScript } = await import('../eval/scriptMetrics.js');
const { otimizarScripts } = await import('./otimizador.js');
const { analisarConversas } = await import('./analista.js');
const { logDecision, _LOG_FILE } = await import('../logs/decisionLog.js');

describe('otimizador (scaffold funcional)', () => {
  it('ranqueia variante com mais handoff no topo, respeitando amostra minima', () => {
    for (let i = 0; i < 6; i++) registrarScript({ variante: 'A', evento: 'enviado' });
    for (let i = 0; i < 4; i++) registrarScript({ variante: 'A', evento: 'handoff' });
    for (let i = 0; i < 6; i++) registrarScript({ variante: 'B', evento: 'enviado' });
    registrarScript({ variante: 'B', evento: 'handoff' });
    const r = otimizarScripts({ minEnviados: 5 });
    expect(r.data.melhor).toBeTruthy();
    expect(r.data.melhor.taxaHandoff).toBeGreaterThanOrEqual(r.data.ranking[r.data.ranking.length - 1].taxaHandoff);
  });
});

describe('analista (scaffold)', () => {
  it('agrega objecoes e taxa de handoff do log de decisao', () => {
    logDecision({ phone: '1', objecaoDetectada: 'caro', handoff: false, complianceViolations: [] });
    logDecision({ phone: '1', objecaoDetectada: 'caro', handoff: true, complianceViolations: ['valor_sem_ressalva'] });
    const r = analisarConversas(_LOG_FILE);
    expect(r.data.totalTurnos).toBeGreaterThanOrEqual(2);
    expect(r.data.objecoesRecorrentes.caro).toBeGreaterThanOrEqual(2);
  });
});
