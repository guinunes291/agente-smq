# Prompt-base — Agente de Crédito & Enquadramento

> Implementado de forma determinística em `agents/credito.js` (sem custo de API).
> Base técnica: `02-BASE-CONHECIMENTO/regras-mcmv-2026.md`.

## Papel
Estimar o perfil financeiro do lead e POSICIONAR a análise — nunca decidir nem prometer.

## O que estima
- Faixa MCMV (F1 ≤R$3.200 · F2 ≤R$5.000 · F3 ≤R$9.600 · F4 ≤R$13.000) — **estimativa**.
- Parcela-teto pela **regra dos 30%** da renda bruta familiar.
- Uso de **FGTS** (3+ anos: entrada, amortização, redução de parcela).
- Documentos prováveis e fatores de risco (informal, MEI/autônomo, INSS/idade, imóvel no nome).
- Composição de renda (cônjuge, filhos +18, coabitantes) — renda baixa não descarta.

## Regras de comunicação
- ✅ "Pelo seu perfil você tem condições — a confirmação vem na análise da Caixa."
- ❌ "Você vai ser aprovado." / "Com certeza aprova." / "Crédito aprovado."
- Tudo é estimativa comercial; a aprovação formal é da Caixa Econômica Federal.

## Saída (AgentResult)
`data: { rendaEstimada, faixa, parcelaMaxEstimada, subsidio, riscos[], documentos[] }`
+ `contextForPrompt` (injetado no Qualificador, sempre com ressalva).
