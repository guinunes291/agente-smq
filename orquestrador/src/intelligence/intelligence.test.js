import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-intel-'));
process.env.METRICS_DIR = path.join(TMP, 'metrics');
process.env.LOG_DIR = path.join(TMP, 'logs');
process.env.EXPERIMENTS_DIR = path.join(TMP, 'experiments');

const { registrarScript } = await import('../eval/scriptMetrics.js');
const { logDecision, _LOG_FILE } = await import('../logs/decisionLog.js');
const scientist = await import('./scientist.js');
const { avaliarConversa } = await import('./quality.js');
const experiments = await import('./experiments.js');

describe('Cientista de Vendas (consolida Analista + Otimizador)', () => {
  it('analisa conversas do log de decisao', () => {
    logDecision({ objecaoDetectada: 'caro', handoff: false, complianceViolations: [] });
    logDecision({ objecaoDetectada: 'caro', handoff: true, complianceViolations: ['valor_sem_ressalva'] });
    const r = scientist.analisarConversas(_LOG_FILE);
    expect(r.data.objecoesRecorrentes.caro).toBeGreaterThanOrEqual(2);
  });

  it('ranqueia variantes por desempenho', () => {
    for (let i = 0; i < 6; i++) registrarScript({ variante: 'A', evento: 'enviado' });
    for (let i = 0; i < 4; i++) registrarScript({ variante: 'A', evento: 'handoff' });
    const r = scientist.otimizarScripts({ minEnviados: 5 });
    expect(r.data.melhor).toBeTruthy();
  });

  it('gera hipoteses para revisao humana', () => {
    const r = scientist.gerarHipoteses(_LOG_FILE);
    expect(Array.isArray(r.data.hipoteses)).toBe(true);
    expect(r.data.hipoteses.length).toBeGreaterThan(0);
  });
});

describe('Agente de Qualidade (score 0-100)', () => {
  it('da nota alta a uma conversa bem conduzida', () => {
    const history = [
      { role: 'assistant', content: 'Oi Joao! Voce busca pra morar ou investir?' },
      { role: 'user', content: 'morar' },
      { role: 'assistant', content: 'Show! Qual regiao voce prefere e quanto voces recebem juntos?' },
      { role: 'user', content: 'zona leste, uns 4 mil' },
      { role: 'assistant', content: 'Perfeito. Vamos adiantar sua analise? Posso agendar.' },
    ];
    const r = avaliarConversa(history, { temperatura: 'QUENTE', handoff: true });
    expect(r.score).toBeGreaterThan(60);
    expect(r.breakdown).toHaveProperty('rapport');
  });

  it('penaliza conversa fraca e sugere melhorias', () => {
    const history = [{ role: 'assistant', content: 'Oi, tudo bem?' }];
    const r = avaliarConversa(history, { temperatura: 'FRIO' });
    expect(r.score).toBeLessThan(60);
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

describe('Experiments (human-in-loop)', () => {
  it('propoe e exige revisao humana para promover', () => {
    const id = experiments.propor({ tipo: 'promover_variante', alvo: 'A' });
    expect(experiments.listar('proposto').some((e) => e.id === id)).toBe(true);
    const promovido = experiments.revisar(id, 'promovido', 'gestor');
    expect(promovido.status).toBe('promovido');
    expect(promovido.revisadoPor).toBe('gestor');
  });
});
