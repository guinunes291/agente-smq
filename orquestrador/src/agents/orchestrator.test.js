import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isola memoria/logs/metricas em tmp ANTES de importar os modulos que leem as envs.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-orch-'));
process.env.MEM_DIR = path.join(TMP, 'memory');
process.env.LOG_DIR = path.join(TMP, 'logs');
process.env.METRICS_DIR = path.join(TMP, 'metrics');
delete process.env.ANTHROPIC_API_KEY; // garante Qualificador em modo stub (sem custo de API)

const { orchestrate } = await import('./orchestrator.js');

function novoLead(over = {}) {
  return {
    phone: '5511999990000',
    nome: 'Teste',
    objetivo: 'morar',
    faixaRenda: '3000',
    regiao: 'Zona Oeste',
    temperatura: 'FRIO',
    estagio: 'primeiro_contato',
    convitesAnaliseVisita: 0,
    history: [{ role: 'user', content: 'oi, vi o anuncio', ts: Date.now() }],
    ...over,
  };
}

describe('orchestrator: shape e integracao (Qualificador stub)', () => {
  it('devolve Decision com o shape esperado', async () => {
    const d = await orchestrate(novoLead(), { text: 'oi' });
    expect(d).toHaveProperty('mensagem_cliente');
    expect(d).toHaveProperty('acoes');
    expect(d).toHaveProperty('temperatura');
    expect(d).toHaveProperty('estagio');
    expect(Array.isArray(d.complianceViolations)).toBe(true);
  });

  it('grava memoria comercial curada do lead', async () => {
    const lead = novoLead();
    await orchestrate(lead, { text: 'quero pra morar, zona oeste' });
    const memFile = path.join(process.env.MEM_DIR, '5511999990000.json');
    expect(fs.existsSync(memFile)).toBe(true);
    const mem = JSON.parse(fs.readFileSync(memFile, 'utf8'));
    expect(mem.objetivo).toBe('morar');
    expect(mem.faixaRenda).toBe('3000');
  });

  it('registra log de decisao com os agentes que rodaram', async () => {
    await orchestrate(novoLead(), { text: 'oi' });
    const logFile = path.join(process.env.LOG_DIR, 'decisions.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const last = fs.readFileSync(logFile, 'utf8').trim().split('\n').pop();
    const rec = JSON.parse(last);
    expect(rec.agentsRun).toContain('qualificador');
    expect(rec.agentsRun).toContain('compliance');
  });

  it('passa objecao detectada para o log quando o cliente objeta', async () => {
    const lead = novoLead({ history: [{ role: 'user', content: 'tá caro demais', ts: Date.now() }] });
    await orchestrate(lead, { text: 'tá caro demais' });
    const logFile = path.join(process.env.LOG_DIR, 'decisions.jsonl');
    const rec = JSON.parse(fs.readFileSync(logFile, 'utf8').trim().split('\n').pop());
    expect(rec.objecaoDetectada).toBe('caro');
  });

  it('define proximaAcao (follow-up) no lead', async () => {
    const lead = novoLead();
    await orchestrate(lead, { text: 'oi' });
    expect(lead.proximaAcao).toBeTruthy();
    expect(lead.proximaAcao).toHaveProperty('intencao');
  });
});
