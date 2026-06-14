// Agente de Auditoria & Compliance.
// Roda DEPOIS do Qualificador, sobre a mensagem que iria para o cliente.
// Determinístico (sem custo de API). Garante:
//  - Nunca prometer aprovacao de credito.
//  - Valores (imovel/entrada/parcela/subsidio) sempre com ressalva.
//  - LGPD: nao pedir dado sensivel (CPF/RG) antes do aceite de analise.
//  - Anti-agressividade: nao insistir alem de 2 convites.
import { ComplianceResultSchema } from './contracts.js';
import { canonical } from '../lib/normalize.js';

// Ressalva-padrao anexada quando ha valor sem ressalva.
export const RESSALVA_PADRAO =
  'Esses valores são estimativos e ficam sujeitos à disponibilidade e à análise de crédito.';

// Frase segura para substituir promessas de aprovacao.
const SUBST_APROVACAO = 'pelo seu perfil você tem boas condições — a confirmação vem na análise da Caixa';

// Promessa de aprovacao (proibido). Regex SEM flag global (uso em .test/.match).
// Cobre "vai ser aprovado", "com certeza aprova", "credito aprovado",
// "garanto a aprovacao", "100% aprovado", "aprovacao garantida".
const APROVACAO_RE =
  /(?:(?:vc |você |voce )?vai\s+(?:ser\s+)?aprovad[oa]|com certeza\s+(?:é\s+)?aprov\w*|cr[ée]dito\s+(?:est[áa]\s+)?aprovad[oa]|garant\w+\s+(?:a\s+)?aprova\w+|aprova[çc][ãa]o\s+garantid[ao]|100%\s+aprovad[oa]|aprovad[oa]\s+(?:com\s+certeza|garantid[oa]))/iu;

// Camada canonica: normaliza para so alfanumerico e detecta promessa de aprovacao
// de forma robusta a acentos, pontuacao decorativa e palavras de preenchimento.
// Padroes diretos (concatenados) + co-ocorrencia (aprovacao + certeza/garantia).
const PROMESSA_DIRETA = [
  'vaiseraprov', 'vaiaprovar', 'creditoaprovad', 'jataaprovad', 'jaestaaprovad',
  'preaprovad', 'aprovadocomcerteza', 'garantoaprovac', 'aprovacaogarantid',
];

function temPromessaCanonica(texto) {
  const ns = canonical(texto).replace(/[^a-z0-9]/g, ''); // so alfanumerico
  const direto = PROMESSA_DIRETA.find((p) => ns.includes(p));
  if (direto) return direto;
  const temAprova = /aprovad|aprova(cao)?/.test(ns);
  const temCerteza = /comcerteza|garantid|garanto|100|certeza/.test(ns);
  return temAprova && temCerteza ? 'aprovacao+certeza' : null;
}

// Ressalvas que, se presentes, tornam a citacao de valor aceitavel.
const RESSALVA_RE =
  /(estimativ|sujeit|an[áa]lise|aproximad|em torno|a partir|pode variar|\bvaria\b|depende|consulta|confirma|disponibilidade|simula)/iu;

// Indica que a mensagem cita VALOR comercial (preco, parcela, entrada, subsidio).
const VALOR_RE =
  /(r\$\s?\d|\bparcela\b|\bentrada\b|\bsubs[íi]dio\b|\bsinal\b|\bfinanciamento de\b)/iu;

// Pedido de dado sensivel (LGPD) cedo demais.
const PII_RE = /\b(cpf|rg\b|documento de identidade|n[uú]mero do documento)\b/iu;
const ESTAGIOS_OK_PII = new Set(['oferta_analise', 'handoff', 'agendado']);

// Convites de visita/analise (para medir insistencia).
const CONVITE_RE = /(agendar|marcar (uma )?visita|fazer (a )?an[áa]lise|vamos (visitar|analisar))/iu;

/**
 * Avalia (e quando possivel corrige) a mensagem do agente.
 * @param {string|null} mensagem
 * @param {Object} lead
 * @returns {import('./contracts.js').ComplianceResult}
 */
export function revisarMensagem(mensagem, lead = {}) {
  const violations = [];
  if (!mensagem || !mensagem.trim()) {
    return ComplianceResultSchema.parse({ approved: true, violations: [], revisedMessage: null });
  }

  let texto = mensagem;
  let bloqueante = false; // violacao 'alta' que obriga NAO enviar

  // 1) Promessa de aprovacao -> neutraliza (substitui todas as ocorrencias).
  const matchAprov = texto.match(APROVACAO_RE);
  const canonHit = temPromessaCanonica(texto);
  if (matchAprov || canonHit) {
    violations.push({ rule: 'promessa_aprovacao', severity: 'alta', excerpt: matchAprov?.[0] || canonHit });
    if (matchAprov) texto = texto.replace(new RegExp(APROVACAO_RE.source, 'giu'), SUBST_APROVACAO);
    // Se a deteccao veio so pela camada canonica (ex.: "pre-aprovado"), nao da
    // para reescrever com seguranca por regex -> bloqueia o envio.
    if (temPromessaCanonica(texto)) bloqueante = true;
  }

  // 2) LGPD: pedir CPF/RG antes do estagio de analise -> bloqueia (nao envia).
  const matchPii = texto.match(PII_RE);
  if (matchPii && !ESTAGIOS_OK_PII.has(lead.estagio)) {
    violations.push({ rule: 'lgpd_pii_cedo', severity: 'alta', excerpt: matchPii[0] });
    bloqueante = true;
  }

  // 3) Valor sem ressalva -> anexa ressalva-padrao.
  const matchValor = texto.match(VALOR_RE);
  if (matchValor && !RESSALVA_RE.test(texto)) {
    violations.push({ rule: 'valor_sem_ressalva', severity: 'media', excerpt: matchValor[0] });
    texto = `${texto.trim()} ${RESSALVA_PADRAO}`;
  }

  // 4) Insistencia: ja fez >=2 convites e ainda convida -> apenas sinaliza.
  if ((lead.convitesAnaliseVisita || 0) >= 2 && CONVITE_RE.test(texto)) {
    violations.push({ rule: 'insistencia_excessiva', severity: 'media', excerpt: 'convite >2' });
  }

  if (bloqueante) {
    return ComplianceResultSchema.parse({ approved: false, violations, revisedMessage: null });
  }

  const revised = texto !== mensagem ? texto : null;
  return ComplianceResultSchema.parse({ approved: true, violations, revisedMessage: revised });
}
