import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-fup-'));
process.env.EVENTS_DIR = path.join(TMP, 'events');
process.env.STATE_FILE = path.join(TMP, 'state.json'); // isola o store deste arquivo
delete process.env.ANTHROPIC_API_KEY; // gerar follow-up usa fallback (sem API)

const { runFollowupCycle, elegivel } = await import('./followupScheduler.js');
const { getLead, saveLead, setGlobalPause } = await import('../state.js');

// Horario comercial garantido (terca 14h BRT = 17h UTC).
const HORARIO_OK = new Date('2026-06-16T17:00:00Z').getTime();
const PASSADO = HORARIO_OK - 10 * 24 * 3600 * 1000;

function novoLeadDue(phone, over = {}) {
  const l = getLead(phone);
  Object.assign(l, {
    nome: 'Teste',
    agentManaged: true,
    optOut: false,
    handoff: false,
    paused: false,
    temperatura: 'MORNO',
    origem: 'whatsapp:zapi', // zapi -> sem restricao de janela 24h
    lastInboundTs: PASSADO,
    sentToday: [],
    followupsSent: 0,
    proximaAcao: { intencao: 'educar_valor', proximaAcaoTs: PASSADO },
    ...over,
  });
  saveLead(l);
  return l;
}

describe('followup scheduler — elegibilidade', () => {
  beforeEach(() => setGlobalPause(false));

  it('lead vencido e valido recebe follow-up', async () => {
    novoLeadDue('5511900000001');
    const enviados = [];
    const r = await runFollowupCycle({
      now: HORARIO_OK,
      sender: async (to, body) => enviados.push({ to, body }),
    });
    expect(r.enviados).toBeGreaterThanOrEqual(1);
    expect(enviados.some((e) => e.to === '5511900000001')).toBe(true);
  });

  it('nao envia para opt-out / handoff / pausado', () => {
    const now = HORARIO_OK;
    expect(elegivel(novoLeadDue('p1', { optOut: true }), now)).toBe(false);
    expect(elegivel(novoLeadDue('p2', { handoff: true }), now)).toBe(false);
    expect(elegivel(novoLeadDue('p3', { paused: true }), now)).toBe(false);
  });

  it('nao envia se atingiu o maximo de toques', () => {
    expect(elegivel(novoLeadDue('p4', { followupsSent: 4 }), HORARIO_OK)).toBe(false);
  });

  it('nao envia se a proxima acao ainda nao venceu', () => {
    expect(elegivel(novoLeadDue('p5', { proximaAcao: { intencao: 'x', proximaAcaoTs: HORARIO_OK + 1e9 } }), HORARIO_OK)).toBe(false);
  });

  it('kill-switch global pausa todos', async () => {
    novoLeadDue('5511900000009');
    setGlobalPause(true);
    const r = await runFollowupCycle({ now: HORARIO_OK, sender: async () => {} });
    expect(r.motivo).toBe('global_pause');
    expect(r.enviados).toBe(0);
    setGlobalPause(false);
  });

  it('fora do horario comercial nao dispara', async () => {
    const madrugada = new Date('2026-06-16T06:00:00Z').getTime(); // 03h BRT
    novoLeadDue('5511900000010');
    const r = await runFollowupCycle({ now: madrugada, sender: async () => {} });
    expect(r.motivo).toBe('fora_horario');
  });

  it('apos enviar, agenda o proximo e incrementa o contador', async () => {
    const lead = novoLeadDue('5511900000011');
    await runFollowupCycle({ now: HORARIO_OK, sender: async () => {} });
    expect(lead.followupsSent).toBe(1);
    expect(lead.proximaAcao.proximaAcaoTs).toBeGreaterThan(HORARIO_OK);
  });
});

describe('followup scheduler — janela 24h da Meta', () => {
  it('lead Meta fora da janela usa template HSM (nao texto livre)', async () => {
    novoLeadDue('5511900000020', { origem: 'whatsapp:meta', lastInboundTs: PASSADO });
    const textos = [];
    const templates = [];
    const r = await runFollowupCycle({
      now: HORARIO_OK,
      sender: async (to, body) => textos.push({ to, body }),
      templateSender: async (to, name) => templates.push({ to, name }),
    });
    expect(r.enviados).toBeGreaterThanOrEqual(1);
    expect(templates.some((t) => t.to === '5511900000020' && t.name === 'reativacao_base')).toBe(true);
    expect(textos.some((t) => t.to === '5511900000020')).toBe(false);
  });
});
