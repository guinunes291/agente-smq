// Mutex assincrono por chave. Serializa o processamento por lead (telefone),
// evitando lost-update no store e chamadas LLM concorrentes para a mesma conversa.
const filas = new Map(); // chave -> Promise da ultima tarefa enfileirada

/**
 * Executa `fn` de forma exclusiva para `chave`. Chamadas concorrentes para a
 * mesma chave rodam em serie (FIFO); chaves diferentes rodam em paralelo.
 * @template T
 * @param {string} chave
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function comLock(chave, fn) {
  const anterior = filas.get(chave) || Promise.resolve();
  // encadeia: a nova tarefa so roda quando a anterior terminar (sucesso ou erro)
  const atual = anterior.then(fn, fn);
  // mantem a cadeia viva, mas limpa o mapa quando esvaziar (evita vazamento)
  const marcado = atual.catch(() => {}).finally(() => {
    if (filas.get(chave) === marcado) filas.delete(chave);
  });
  filas.set(chave, marcado);
  return atual;
}

// Exposto para testes: quantas chaves estao com lock ativo.
export function _locksAtivos() {
  return filas.size;
}
