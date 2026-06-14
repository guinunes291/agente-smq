# Benchmark Global — onde estamos vs. plataformas de referência

Comparação honesta da arquitetura do orquestrador SMQ com plataformas de IA comercial.

| Plataforma | O que fazem bem | Onde ganhamos deles | Onde perdemos (e como fechar) |
|------------|-----------------|---------------------|-------------------------------|
| **Salesforce Einstein** | Scoring/forecast no CRM, governança | Vertical MCMV nativa; agente fala com o lead no WhatsApp | Governança/observabilidade madura → KPIs + dashboard |
| **HubSpot AI** | Automação de marketing, UX | Conhecimento de crédito (FGTS, faixas, Portaria 333) | Painel/relatórios → dashboard de KPI (fase Estável) |
| **Gong / Chorus** | Conversation analytics em escala | Dado proprietário (WhatsApp + venda MCMV) | Análise em escala → Qualidade + Cientista |
| **Drift** | Chat de conversão | Compliance determinístico de domínio | Roteamento/playbooks prontos → roteamento por aderência |
| **Intercom Fin** | Resolução autônoma com guardrails | Qualificação 7-dim + handoff humano | Observabilidade/guardrails de produto → telemetria + gate humano |
| **OpenAI Agents** | Tooling de agentes genérico | Domínio + regras de negócio embutidas | Orquestração com estado → Repository + (fila) |
| **CrewAI / AutoGen** | Multiagentes genéricos | Agentes especializados de venda imobiliária | Grafo/estado durável → Repository + workers |
| **LangGraph** | Grafos de estado com checkpoint | Simplicidade e baixo custo (1 LLM/turno) | Checkpoint/retry de grafo → fila + estado no DB |
| **Relevance AI** | Low-code de agentes | Custo controlado e código próprio | Marketplace/UX → fora de escopo (foco em conversão) |

## Leitura estratégica
- **Nossa vantagem defensável** é o **dado proprietário**: conversas reais de WhatsApp
  ligadas ao **desfecho de venda MCMV**. Nenhum genérico tem isso. O valor está no
  **loop de aprendizado** sobre esse dado (Qualidade → Cientista → Experimentos → gate humano).
- **Onde mais perdemos hoje** é **infra de escala** (fila, multi-instância) e
  **observabilidade/painel** — itens já desenhados, a ligar na fase Estável.
- **Princípio de custo:** 1 chamada LLM por turno + especialistas determinísticos
  nos mantém mais baratos que arquiteturas multi-LLM por turno.
