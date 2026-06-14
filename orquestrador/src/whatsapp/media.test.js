import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isola o store deste arquivo ANTES de importar os modulos que leem STATE_FILE.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'smq-media-'));
process.env.STATE_FILE = path.join(TMP, 'state.json');
process.env.EVENTS_DIR = path.join(TMP, 'events');

const meta = await import('./meta.js');
const zapi = await import('./zapi.js');
const { handleInbound } = await import('../processor.js');
const { getLead, saveLead } = await import('../state.js');

describe('parseInbound — midia', () => {
  it('Meta: audio vira inbound com mediaType (nao e descartado)', () => {
    const body = { entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Joao' } }], messages: [{ id: 'm1', from: '5511999990001', type: 'audio', timestamp: '1700000000' }] } }] }] };
    const out = meta.parseInbound(body);
    expect(out.length).toBe(1);
    expect(out[0].mediaType).toBe('audio');
    expect(out[0].text).toBe('');
  });

  it('Meta: imagem com legenda usa a legenda como texto', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ id: 'm2', from: '5511999990002', type: 'image', image: { caption: 'quero esse' }, timestamp: '1700000000' }] } }] }] };
    const out = meta.parseInbound(body);
    expect(out[0].mediaType).toBe('image');
    expect(out[0].text).toBe('quero esse');
  });

  it('Z-API: audio vira inbound com mediaType', () => {
    const out = zapi.parseInbound({ phone: '5511999990003', audio: { url: 'x' }, messageId: 'z1' });
    expect(out.length).toBe(1);
    expect(out[0].mediaType).toBe('audio');
  });
});

describe('processor — midia sem texto', () => {
  it('responde pedindo texto e nao repete dentro de 1h', async () => {
    const phone = '5511999990010';
    const lead = getLead(phone);
    lead.agentManaged = true;
    saveLead(lead);

    const enviados = [];
    const sender = async (to, body) => enviados.push({ to, body });

    const r1 = await handleInbound({ channel: 'zapi', from: phone, mediaType: 'audio', text: '', ts: Date.now() }, { sender });
    expect(r1.sent).toBeTruthy();
    expect(enviados.length).toBe(1);

    // segunda midia logo em seguida -> throttled (nao reenvia)
    const r2 = await handleInbound({ channel: 'zapi', from: phone, mediaType: 'audio', text: '', ts: Date.now() }, { sender });
    expect(r2.throttled).toBe(true);
    expect(enviados.length).toBe(1);
  });
});
