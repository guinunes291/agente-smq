import { describe, it, expect } from 'vitest';
import { detectarObjecao } from './objecoes.js';

const ctx = (inboundText) => ({ inboundText });

describe('objecoes: deteccao', () => {
  it('"vou pensar melhor" -> vou_pensar', () => {
    const r = detectarObjecao(ctx('Acho que vou pensar melhor sobre isso'));
    expect(r.data.principal).toBe('vou_pensar');
    expect(r.flags).toContain('objecao_detectada');
  });

  it('"não tenho entrada" -> sem_entrada', () => {
    const r = detectarObjecao(ctx('O problema é que não tenho entrada'));
    expect(r.data.objecoesDetectadas).toContain('sem_entrada');
  });

  it('"meu nome está sujo" -> medo_credito e nunca sugere prometer aprovacao', () => {
    const r = detectarObjecao(ctx('tenho medo porque meu nome está sujo no serasa'));
    expect(r.data.objecoesDetectadas).toContain('medo_credito');
    expect(/nunca prometa aprovacao/i.test(r.contextForPrompt)).toBe(true);
  });

  it('"tá muito caro" -> caro', () => {
    const r = detectarObjecao(ctx('nossa, tá muito caro isso'));
    expect(r.data.objecoesDetectadas).toContain('caro');
  });

  it('"preciso falar com meu marido" -> conjuge', () => {
    const r = detectarObjecao(ctx('preciso falar com meu marido antes'));
    expect(r.data.objecoesDetectadas).toContain('conjuge');
  });

  it('mensagem neutra nao detecta objecao', () => {
    const r = detectarObjecao(ctx('quero morar na zona leste, 2 dormitorios'));
    expect(r.flags).not.toContain('objecao_detectada');
    expect(r.contextForPrompt).toBe('');
  });
});
