# Auditoria Red-Team — Orquestrador SMQ

Auditoria adversarial do sistema multiagentes ("tente destruir o sistema").
Cada achado tem impacto, causa-raiz e correção. Status nesta fase: ✅ corrigido · 🟡 desenhado.

| # | Achado | Impacto | Causa-raiz | Correção | Status |
|---|--------|---------|------------|----------|--------|
| 1 | State em arquivo reescrito a cada save (`state.js`) | Race/corrupção; perda no redeploy; I/O O(n) | Arquivo como sistema de registro | `data/repository.js` (backend CRM/TiDB) + `forget()` | ✅ (adapter) / 🟡 migração total |
| 2 | Webhook sem idempotência (`index.js`) | Resposta duplicada, double-handoff, risco de bloqueio | Sem dedupe por message-id | `lib/idempotency.js` + uso nos webhooks | ✅ |
| 3 | Sem serialização por lead | Lost-update + 2 chamadas LLM | Sem mutex | `lib/mutex.js` no `processor` (por telefone) | ✅ |
| 4 | Opt-out por substring (`guards.js`) | "parar de pagar aluguel" → opt-out falso → lead perdido | Match ingênuo | Intenção real (msg curta/frase inequívoca) + testes | ✅ |
| 5 | Compliance regex burlável | "pré-aprovado"/typos vazam promessa → risco jurídico | Sem normalização | Forma canônica + co-ocorrência + testes adversariais | ✅ |
| 6 | Decision não validada (Zod) | Campos fora do enum quebram `executarAcao` | Parse sem schema | `DecisionSchema.safeParse` + saneamento | ✅ |
| 7 | Base reinjetada todo turno | Custo de token alto @escala | Prompt 100% dinâmico | Prompt caching (`cache_control`) no prefixo estável | ✅ |
| 8 | PII em texto puro (arquivos) | Risco LGPD (sem retenção/erasure) | Persistência em arquivo | Pseudonimização (phoneHash) nos logs + `forget()` | ✅ |
| 9 | Sem ligação conversa→desfecho | Aprendizado impossível | Desfecho mora no CRM | Endpoint `GET /api/agent/outcome` + `conversationId↔leadId` | ✅ |
| 10 | Observabilidade = console.log | Cego em produção | Sem telemetria | `telemetry/events.js` + `eval/kpis.js` | ✅ |
| 11 | `upsertLeadCRM` append em CSV | Crescimento ilimitado/duplicatas | CSV como log | Substituído por evento/Repository | 🟡 (CRM events pronto) |
| 12 | Variante não vinculada a desfecho | Não dá para otimizar script | Falta hook no envio | `scriptMetrics` + eventos por variante | 🟡 (plumbing pronto) |
| 13 | Sem retry/circuit-breaker | Turno perdido | Falha silenciosa | `lib/retry.js` (backoff) + `lib/deadletter.js` | ✅ |
| 14 | Processa inline no webhook | Perda em crash | Sem fila | Dead-letter de turnos falhos (fila durável → Estável) | 🟡 (dead-letter ✅) |
| 15 | Single-instance | Teto de escala | Estado local | Estado/rotation no DB/Redis | 🟡 fase Estável |
| 16 | Agente só reativo (sem follow-up) | Lead que some nunca é reabordado | Sem scheduler | `jobs/followupScheduler.js` (loop proativo) | ✅ |
| 17 | Mídia descartada (áudio/imagem) | Lead recebe silêncio | parseInbound só texto | mediaType + resposta gentil no processor | ✅ |
| 18 | Sem botão de pânico | Não dá para parar tudo rápido | Sem kill-switch | `/admin/pause-all` + pausa global | ✅ |

## Como reproduzir as correções
- `npm test` cobre: opt-out falso-positivo (4), promessa de aprovação adversarial (5),
  Zod (6), idempotência (2), mutex (3), KPIs (10), erasure LGPD (8/1).
