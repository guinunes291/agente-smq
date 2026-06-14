import { describe, it, expect } from 'vitest';
import { comLock } from './mutex.js';
import { registrarSeNovo, _tamanho } from './idempotency.js';
import { canonical, semAcento, numPalavras, pseudonimo } from './normalize.js';
import { isOptOutMessage } from '../guards.js';

describe('mutex: comLock', () => {
  it('serializa tarefas da mesma chave (sem intercalar)', async () => {
    const ordem = [];
    const tarefa = (id, ms) => async () => {
      ordem.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, ms));
      ordem.push(`end-${id}`);
      return id;
    };
    const p1 = comLock('A', tarefa(1, 20));
    const p2 = comLock('A', tarefa(2, 1));
    await Promise.all([p1, p2]);
    // a tarefa 2 so pode comecar depois da 1 terminar
    expect(ordem).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('chaves diferentes rodam em paralelo', async () => {
    const r = await Promise.all([comLock('X', async () => 'x'), comLock('Y', async () => 'y')]);
    expect(r).toEqual(['x', 'y']);
  });

  it('erro em uma tarefa nao trava a fila da chave', async () => {
    await expect(comLock('Z', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ok = await comLock('Z', async () => 'ok');
    expect(ok).toBe('ok');
  });
});

describe('idempotency', () => {
  it('primeira vez e nova; repetida e ignorada', () => {
    const id = 'msg-' + Math.random();
    expect(registrarSeNovo(id)).toBe(true);
    expect(registrarSeNovo(id)).toBe(false);
  });
  it('sem id nao bloqueia (processa)', () => {
    expect(registrarSeNovo(null)).toBe(true);
    expect(registrarSeNovo(undefined)).toBe(true);
  });
});

describe('normalize', () => {
  it('remove acentos e baixa caixa', () => {
    expect(semAcento('Pré-Aprovação')).toBe('Pre-Aprovacao');
    expect(canonical('Pré-Aprovado')).toBe('preaprovado');
  });
  it('junta pontuacao decorativa', () => {
    expect(canonical('a.p.r.o.v.a.d.o')).toBe('aprovado');
  });
  it('conta palavras e gera pseudonimo estavel', () => {
    expect(numPalavras('quero sair do aluguel')).toBe(4);
    expect(pseudonimo('5511999990000')).toBe(pseudonimo('5511999990000'));
    expect(pseudonimo('5511999990000')).not.toContain('5511');
  });
});

describe('opt-out preciso (corrige falso positivo)', () => {
  it('mensagem curta com palavra-chave dispara', () => {
    expect(isOptOutMessage('SAIR')).toBe(true);
    expect(isOptOutMessage('parar')).toBe(true);
    expect(isOptOutMessage('quero cancelar')).toBe(true);
  });
  it('frase inequivoca dispara mesmo longa', () => {
    expect(isOptOutMessage('por favor, não quero mais receber essas mensagens')).toBe(true);
  });
  it('NAO dispara em "parar de pagar aluguel" / "sair do aluguel"', () => {
    expect(isOptOutMessage('quero parar de pagar aluguel')).toBe(false);
    expect(isOptOutMessage('meu sonho é sair do aluguel esse ano')).toBe(false);
  });
  it('NAO dispara em conversa normal', () => {
    expect(isOptOutMessage('quero ver apartamento na zona leste')).toBe(false);
  });
});
