// Normalizacao de texto para deteccao robusta (compliance, opt-out).
// Remove acentos, baixa caixa, colapsa espacos e remove pontuacao "decorativa"
// usada para burlar filtros (ex.: "a.p.r.o.v.a.d.o", "pre-aprovado").

// Combining Diacritical Marks: U+0300–U+036F
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Remove acentos/diacriticos. */
export function semAcento(s = '') {
  return String(s).normalize('NFD').replace(DIACRITICOS, '');
}

/** Forma canonica para casamento de padroes. */
export function canonical(s = '') {
  return semAcento(String(s).toLowerCase())
    .replace(/[._\-*]+/g, '') // junta "a.p.r.o.v.a.d.o" / "pre-aprovado" -> "preaprovado"
    .replace(/\s+/g, ' ')
    .trim();
}

/** Contagem de palavras (para heuristica de mensagem curta). */
export function numPalavras(s = '') {
  const t = String(s).trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Hash curto e estavel (pseudonimizacao de telefone em logs — djb2, sem PII exposta). */
export function pseudonimo(s = '') {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'ph_' + h.toString(36);
}
