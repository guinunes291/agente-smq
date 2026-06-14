# KPIs por Agente

Princípio: **nenhum agente sem KPI**. Definições em `src/eval/kpis.js` (`KPIS`),
agregadas a partir dos eventos de `src/telemetry/events.js`.

| Agente | KPIs | Como medir |
|--------|------|------------|
| **Qualificador** | taxa de resposta, % qualificação completa (7 dim.), taxa de agendamento, tempo de 1ª resposta | eventos `resposta` + desfecho do CRM |
| **Objeções** | taxa de recuperação (objeção→avança), objeções mais frequentes | evento `deteccao` + transição de estágio |
| **Crédito** | aderência da faixa estimada vs. análise real, % com FGTS mapeado | evento `analise` + outcome do CRM |
| **Produto** | taxa de aderência (match→interesse/visita) | evento `match` (kpi `taxa_aderencia`) + visita |
| **Follow-up** | taxa de reengajamento (sumiu→responde) | comportamento + resposta subsequente |
| **Compliance** | violações/1000 msgs, % bloqueadas, falsos positivos | evento `revisao` (kpi `pct_bloqueadas`) |
| **Memória** | precisão dos campos vs. dados confirmados no CRM | merge vs. outcome |
| **Orquestrador** | turnos/conversa, custo de token/conversa, latência | evento `turno` (kpi `latencia_ms`) |
| **Qualidade** (intel.) | distribuição de score 0–100, score médio por estágio | `intelligence/quality.js` |
| **Cientista** (intel.) | nº hipóteses, % promovidas (gate humano) | `intelligence/experiments.js` |

## Esquema de evento
```json
{ "ts": "...", "conversationId": "crm:123|ph_xxx", "phoneHash": "ph_xxx",
  "agent": "compliance", "type": "revisao", "kpi": "pct_bloqueadas",
  "value": 0, "meta": { "violations": [] } }
```

## Cobertura de observabilidade
`agentesSemTelemetria()` lista agentes do catálogo que ainda não emitiram eventos —
use em CI/monitoração para garantir que todo agente reporta.
