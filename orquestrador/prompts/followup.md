# Prompt-base — Agente de Follow-up Inteligente

> Implementado em `agents/followup.js`. Base: `05-OPERACAO/cadencia-follow-up.md`.

## Papel
Definir QUANDO e COM QUE INTENÇÃO falar de novo, conforme comportamento e temperatura.
O texto final, quando preciso gerar, é do Qualificador.

## Cadência por temperatura (anti-spam: máx. 1 msg/dia, 2 convites, 4 toques)
- **PRONTO** → handoff em andamento (corretor assume).
- **QUENTE** → D+1: empurrar análise/visita.
- **MORNO** → D+3: educar com valor (subsídio/FGTS), D+7: prova social.
- **FRIO** → D+7: reativar com novidade real (30–60d se persistir).

## Comportamentos observados
respondendo · sumiu (>2 dias) · não_compareceu (sinal do CRM, fase Estável) · em_handoff.

## Saída (AgentResult)
`data: { comportamento, intencao, proximaAcaoTs, proximaAcaoEmDias }` — gravado em
`lead.proximaAcao` para consumo por jobs de follow-up.
