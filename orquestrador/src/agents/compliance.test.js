import { describe, it, expect } from 'vitest';
import { revisarMensagem, RESSALVA_PADRAO } from './compliance.js';

describe('compliance: promessa de aprovacao', () => {
  it('bloqueia/neutraliza "voce vai ser aprovado"', () => {
    const r = revisarMensagem('Pode ficar tranquilo, você vai ser aprovado sem problema!', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'promessa_aprovacao')).toBe(true);
    // mensagem revisada nao pode mais conter a promessa
    if (r.revisedMessage) expect(/vai ser aprovad/iu.test(r.revisedMessage)).toBe(false);
  });

  it('detecta "com certeza aprova"', () => {
    const r = revisarMensagem('Com certeza aprova, relaxa.', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'promessa_aprovacao')).toBe(true);
  });

  it('detecta "credito aprovado"', () => {
    const r = revisarMensagem('Seu crédito está aprovado!', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'promessa_aprovacao')).toBe(true);
  });

  it('nao acusa frase correta sobre analise', () => {
    const r = revisarMensagem('Pelo seu perfil você tem condições; a confirmação vem na análise da Caixa.', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'promessa_aprovacao')).toBe(false);
  });
});

describe('compliance: valores com ressalva', () => {
  it('anexa ressalva quando cita parcela sem ressalva', () => {
    const r = revisarMensagem('A parcela fica em R$ 1.200 por mês.', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'valor_sem_ressalva')).toBe(true);
    expect(r.revisedMessage).toContain(RESSALVA_PADRAO);
  });

  it('nao duplica ressalva quando ja ha "sujeito a analise"', () => {
    const r = revisarMensagem('A parcela fica em torno de R$ 1.200, sujeito à análise.', { estagio: 'qualificando' });
    expect(r.violations.some((v) => v.rule === 'valor_sem_ressalva')).toBe(false);
  });

  it('mensagem sem valor passa limpa', () => {
    const r = revisarMensagem('Você busca imóvel para morar ou investir?', { estagio: 'qualificando' });
    expect(r.approved).toBe(true);
    expect(r.violations.length).toBe(0);
    expect(r.revisedMessage).toBeNull();
  });
});

describe('compliance: LGPD', () => {
  it('bloqueia pedido de CPF em estagio de qualificacao', () => {
    const r = revisarMensagem('Me manda seu CPF para eu adiantar.', { estagio: 'qualificando' });
    expect(r.approved).toBe(false);
    expect(r.revisedMessage).toBeNull();
    expect(r.violations.some((v) => v.rule === 'lgpd_pii_cedo')).toBe(true);
  });

  it('permite pedir CPF apos aceite de analise', () => {
    const r = revisarMensagem('Perfeito! Me passa seu CPF para iniciar a análise.', { estagio: 'oferta_analise' });
    expect(r.violations.some((v) => v.rule === 'lgpd_pii_cedo')).toBe(false);
  });
});

describe('compliance: insistencia', () => {
  it('sinaliza convite alem de 2', () => {
    const r = revisarMensagem('Vamos agendar a visita então?', { estagio: 'oferta_visita', convitesAnaliseVisita: 2 });
    expect(r.violations.some((v) => v.rule === 'insistencia_excessiva')).toBe(true);
  });
});
