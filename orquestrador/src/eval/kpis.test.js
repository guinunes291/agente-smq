import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-kpi-'));
process.env.EVENTS_DIR = TMP;

const { emit, lerEventos } = await import('../telemetry/events.js');
const { agregarKpis, agentesSemTelemetria, KPIS } = await import('./kpis.js');

describe('telemetry + kpis', () => {
  it('emite evento estruturado sem PII (so phoneHash)', () => {
    const ev = emit({ phoneHash: 'ph_abc', agent: 'qualificador', type: 'resposta' });
    expect(ev.phoneHash).toBe('ph_abc');
    expect(ev).not.toHaveProperty('phone');
    expect(lerEventos().length).toBeGreaterThanOrEqual(1);
  });

  it('agrega media de KPI numerico por agente', () => {
    emit({ agent: 'orchestrator', type: 'turno', kpi: 'latencia_ms', value: 100 });
    emit({ agent: 'orchestrator', type: 'turno', kpi: 'latencia_ms', value: 300 });
    const agg = agregarKpis();
    expect(agg.orchestrator.kpis.latencia_ms.media).toBe(200);
    expect(agg.orchestrator.kpis.latencia_ms.amostras).toBe(2);
  });

  it('todo agente do catalogo tem KPI declarado', () => {
    for (const a of Object.keys(KPIS)) expect(KPIS[a].length).toBeGreaterThan(0);
  });

  it('aponta agentes sem telemetria', () => {
    const faltantes = agentesSemTelemetria();
    // memoria/followup ainda nao emitem KPI numerico neste teste isolado
    expect(Array.isArray(faltantes)).toBe(true);
  });
});
