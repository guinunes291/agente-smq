// Deduplicacao de mensagens (idempotencia de webhook). Meta e Z-API podem
// reentregar a MESMA mensagem; processar duas vezes gera resposta duplicada e
// risco de bloqueio. Guardamos os ids ja vistos com TTL em memoria.
const TTL_MS = Number(process.env.IDEMPOTENCY_TTL_MS) || 6 * 60 * 60 * 1000; // 6h
const vistos = new Map(); // id -> expiraEm

function limpar(agora) {
  for (const [id, exp] of vistos) if (exp <= agora) vistos.delete(id);
}

/**
 * Marca um id como processado. Retorna true se for NOVO (pode processar),
 * false se ja foi visto dentro do TTL (deve ignorar).
 * @param {string|null|undefined} id
 * @returns {boolean}
 */
export function registrarSeNovo(id) {
  if (!id) return true; // sem id confiavel: nao bloqueia (melhor processar do que perder)
  const agora = Date.now();
  if (vistos.size > 5000) limpar(agora); // poda preguicosa
  const exp = vistos.get(id);
  if (exp && exp > agora) return false; // duplicado
  vistos.set(id, agora + TTL_MS);
  return true;
}

export function _tamanho() {
  return vistos.size;
}
