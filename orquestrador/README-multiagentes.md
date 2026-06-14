# Arquitetura Multiagentes — Orquestrador SMQ

Camada multiagentes de qualificação imobiliária da **Seu Metro Quadrado**, construída
sobre o orquestrador conversacional existente (Node.js + Anthropic SDK + Express).
Mantém o padrão **agent-first**: o agente qualifica o lead e só faz handoff ao corretor
após o aceite de análise/visita.

## Princípio de design
**1 chamada LLM por turno + especialistas baratos.** O **Qualificador** é a única chamada
ao modelo. Os especialistas **Crédito**, **Objeções** e **Produto** rodam de forma
determinística e **enriquecem o prompt** do Qualificador. O **Compliance** roda depois,
como guard determinístico sobre a mensagem. Cada especialista foi desenhado para virar
sua própria chamada LLM no futuro, sem reescrever o fluxo.

## Fluxo de um turno (`agents/orchestrator.js` → `orchestrate(lead, inbound)`)
1. Monta `AgentContext` (lead + knowledge + memória + texto + hora BRT).
2. Especialistas determinísticos: **Crédito** (enquadramento MCMV), **Objeções**
   (detecção + script), **Produto** (match) e **Follow-up** (próxima ação).
3. **Qualificador** (LLM) com prompt enriquecido → `Decision` JSON.
4. **Compliance** revisa a mensagem (bloqueia/anexa ressalva).
5. **Memória** grava aprendizados curados.
6. **Follow-up** registra `lead.proximaAcao`.
7. **decisionLog** grava 1 linha JSONL auditável.

> Integração no `processor.js`: troca única de `runAgent(lead)` por
> `orchestrate(lead, inbound)`. Todos os guards (opt-out, anti-loop, rate-limit,
> horário, delay humano) permanecem intactos.

## Agentes
| Agente | Arquivo | Tipo |
|--------|---------|------|
| Orquestrador | `agents/orchestrator.js` | coordenação |
| Qualificador Principal | `agents/qualificador.js` | LLM |
| Crédito & Enquadramento | `agents/credito.js` | determinístico |
| Objeções | `agents/objecoes.js` | determinístico |
| Produto Imobiliário | `agents/produto.js` | determinístico |
| Auditoria & Compliance | `agents/compliance.js` | determinístico |
| Follow-up Inteligente | `agents/followup.js` | determinístico |
| Memória Comercial | `agents/memoria.js` + `memory/repository.js` | persistência |
| **Camada de Inteligência** (offline, human-in-loop): | | |
| Cientista de Vendas (consolida Analista + Otimizador) | `intelligence/scientist.js` | job offline |
| Qualidade (score 0–100) | `intelligence/quality.js` | avaliação |
| Treinamento (playbooks) | `intelligence/training.js` | job offline |
| Experimentos (gate humano) | `intelligence/experiments.js` | governança |

## Contratos (`agents/contracts.js`, Zod + JSDoc)
- `AgentContext` `{ lead, knowledge, memory, inboundText, now }`
- `AgentResult` `{ agent, summary, contextForPrompt, data, flags[] }` — saída dos especialistas
- `Decision` `{ mensagem_cliente, acoes[], temperatura, estagio, handoff }` — shape idêntico ao legado
- `ComplianceResult` `{ approved, violations[], revisedMessage|null }`

> Especialistas **nunca enviam mensagem**; só produzem `contextForPrompt`/`data`.
> Só o Qualificador gera texto; só o Compliance pode reescrevê-lo.

## Prompts, memória e avaliação
- **Prompts-base**: `prompts/*.md` (documentação) + base operacional em `01-CONTEXTO-AGENTE/`.
- **Memória**: `memory/repository.js` — `FileMemoryRepository` (JSON em `data/memory/`),
  com allowlist curada (LGPD-mínimo); `CrmMemoryRepository` (stub) para a fase Estável.
- **Logs de decisão**: `data/logs/decisions.jsonl` (sem texto do cliente).
- **Métricas de script**: `eval/scriptMetrics.js` → `data/metrics/scripts.jsonl`,
  com `agregarPorVariante()` (taxa de resposta/handoff).

## Como rodar
```bash
npm install
npm test          # suite Vitest (determinísticos rodam sem ANTHROPIC_API_KEY)
npm run test:local # smoke end-to-end com Qualificador em stub
npm run dev       # sobe o servidor (precisa do .env)
```

## Segurança / LGPD / Compliance
- Nunca prometer aprovação (Compliance bloqueia, com teste).
- Valores sempre com ressalva (Compliance anexa).
- CPF/RG só após aceite de análise (LGPD).
- Memória mínima e curada; logs sem conteúdo da conversa.
- Anti-spam preservado: opt-out, rate-limit, horário, delay, máx. 2 convites.

## Fase 2 — Hardening, dados duráveis e inteligência
Esta fase corrigiu os achados de red-team (ver `docs/AUDITORIA-RED-TEAM.md`) e
adicionou:
- **Runtime resiliente:** mutex por lead (`lib/mutex.js`), idempotência de webhook
  (`lib/idempotency.js`), opt-out preciso (`guards.js`), validação Zod do Decision,
  compliance anti-evasão (forma canônica), prompt caching.
- **Dados duráveis:** `data/repository.js` (file|CRM-TiDB), `forget()` (LGPD), e
  endpoints `/api/agent/*` no CRM (conversa, eventos, eval, **outcome** — liga
  conversa→desfecho). Ativar via `DATA_BACKEND=crm` + `AGENT_API_TOKEN`.
- **Observabilidade:** `telemetry/events.js` + `eval/kpis.js` (KPI por agente,
  telefone pseudonimizado). Ver `docs/KPIS.md`.
- **Inteligência (human-in-loop):** Qualidade, Cientista de Vendas, Treinamento,
  Experimentos. Nada é auto-promovido — gestor aprova.

Documentos: `docs/AUDITORIA-RED-TEAM.md`, `docs/BENCHMARK.md`, `docs/RISCOS-100K.md`, `docs/KPIS.md`.

## Operação autônoma (Tier 1 — sem intervenção humana)
- **Follow-up proativo** (`jobs/followupScheduler.js`): o agente reabordando sozinho
  os leads no tempo certo (por temperatura), respeitando opt-out, handoff, pausa,
  rate-limit, horário comercial, máximo de toques e a **janela 24h da Meta** (fora
  dela usa template HSM `reativacao_base`). Liga no boot; `FOLLOWUP_DISABLED=1` desliga.
- **Kill-switch global** (`/admin/pause-all` · `/admin/resume-all` · `/admin/status`):
  para inbound e follow-up de todos os leads — botão de pânico para rodar sem vigilância.
- **Resiliência** (`lib/retry.js` + `lib/deadletter.js`): chamadas a Anthropic/Meta/
  Z-API com retry+backoff (só erros transientes); turno que falha de vez vai para
  dead-letter (`data/deadletter/`) em vez de o lead ficar em silêncio.
- **Mídia**: áudio/imagem sem texto recebem resposta pedindo texto (1x/h), sem silêncio.

## Roadmap
- **Fase 1 (MVP):** 10 agentes + Compliance + Memória file + logs + métricas.
- **Fase 2 (atual):** hardening (red-team 1–10), backbone durável, KPIs, camada de
  inteligência consolidada (scaffold), docs estratégicos.
- **Estável:** ativar Qualidade/Cientista (LLM) sobre dados reais; fila+retries+DLQ;
  dashboard de KPI; A/B com gate humano; multi-instância.
- **Avançado:** score preditivo de conversão; geração+teste automático de variantes
  (gate humano); personalização por corretor/região; eval com conversas-golden.
