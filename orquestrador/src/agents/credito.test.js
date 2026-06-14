import { describe, it, expect } from 'vitest';
import { parseRenda, estimarFaixa, analisarCredito } from './credito.js';

describe('credito: parseRenda', () => {
  it('extrai limite superior de uma faixa "2000-4400"', () => {
    expect(parseRenda('2000-4400')).toBe(4400);
  });
  it('le valor com R$ e ponto de milhar', () => {
    expect(parseRenda('R$ 3.500')).toBe(3500);
  });
  it('aceita numero direto', () => {
    expect(parseRenda(2800)).toBe(2800);
  });
  it('retorna null sem renda', () => {
    expect(parseRenda(null)).toBeNull();
    expect(parseRenda('')).toBeNull();
  });
});

describe('credito: estimarFaixa', () => {
  it('classifica F1/F2/F3/F4 e fora', () => {
    expect(estimarFaixa(2800).faixa).toBe('F1');
    expect(estimarFaixa(4800).faixa).toBe('F2');
    expect(estimarFaixa(8000).faixa).toBe('F3');
    expect(estimarFaixa(12000).faixa).toBe('F4');
    expect(estimarFaixa(20000)).toBeNull();
  });
});

describe('credito: analisarCredito', () => {
  it('sinaliza sem_renda quando faixaRenda ausente', () => {
    const r = analisarCredito({ lead: {} });
    expect(r.flags).toContain('sem_renda');
    expect(r.data.faixa).toBeNull();
  });

  it('calcula faixa, parcela-teto (30%) e nunca promete aprovacao', () => {
    const r = analisarCredito({ lead: { faixaRenda: '3000' } });
    expect(r.data.faixa).toBe('F1');
    expect(r.data.parcelaMaxEstimada).toBe(900);
    expect(/aprovad/i.test(r.contextForPrompt)).toBe(false);
    expect(/an[áa]lise/i.test(r.contextForPrompt)).toBe(true);
  });

  it('renda acima de F4 cai para fora do MCMV', () => {
    const r = analisarCredito({ lead: { faixaRenda: '18000' } });
    expect(r.data.faixa).toBe('fora_mcmv');
  });

  it('detecta risco de renda informal sem descartar', () => {
    const r = analisarCredito({ lead: { faixaRenda: '2500', objetivo: 'morar', observacoes: 'trabalho informal' } });
    expect(r.data.riscos.join(' ')).toMatch(/informal/);
  });
});
