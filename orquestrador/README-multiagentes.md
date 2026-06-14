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
| Analista de Conversas | `agents/analista.js` | job offline (scaffold) |
| Otimizador de Scripts | `agents/otimizador.js` | job offline (scaffold) |

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

## Roadmap
- **MVP (atual):** Orquestrador + Qualificador + Crédito + Objeções + Produto +
  Compliance funcionais; Memória (file); logs; métricas; scaffolds de Follow-up
  ligável/Analista/Otimizador; contratos + testes.
- **Estável:** Follow-up nos jobs; `CrmMemoryRepository` via API; persistência de
  conversa no CRM; Analista em lote; painel de conversão por script.
- **Avançado:** cada especialista como chamada LLM (tool-use); Otimizador com A/B
  automático atualizando prompts; personalização por corretor/região; eval com golden.
