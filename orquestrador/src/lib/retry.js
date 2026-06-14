// Retry com backoff exponencial para chamadas externas (Anthropic/Meta/Z-API/CRM).
// So tenta de novo em erros TRANSIENTES (rede, 429, 5xx, 529). Erros de logica
// (4xx exceto 429) falham na hora.

const TRANSIENTES = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

export function ehTransiente(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  if (status) return TRANSIENTES.has(Number(status));
  // sem status -> provavel erro de rede (ECONNRESET, ETIMEDOUT, etc.)
  const code = err.code || '';
  return /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|socket hang up/i.test(code + ' ' + (err.message || ''));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn` com ate `tentativas` tentativas e backoff exponencial.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{tentativas?:number, baseMs?:number, fatorJitter?:number, rotulo?:string}} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { tentativas = 3, baseMs = 500, rotulo = 'call' } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimoErro = err;
      const ultima = i === tentativas - 1;
      if (ultima || !ehTransiente(err)) throw err;
      const espera = Math.round(baseMs * 2 ** i * (0.5 + Math.random())); // backoff + jitter
      console.warn(`[retry:${rotulo}] tentativa ${i + 1}/${tentativas} falhou (${err.status || err.code || err.message}); retry em ${espera}ms`);
      await sleep(espera);
    }
  }
  throw ultimoErro;
}
