# Prompt-base — Agente de Auditoria & Compliance

> Implementado de forma determinística em `agents/compliance.js`. Roda DEPOIS do
> Qualificador, sobre a `mensagem_cliente`, antes do envio.

## Papel
Impedir mensagens perigosas e garantir conformidade comercial e LGPD.

## Regras aplicadas
1. **Promessa de aprovação** (alta) — bloqueia/neutraliza "vai ser aprovado",
   "com certeza aprova", "crédito aprovado", "aprovação garantida".
2. **Valor sem ressalva** (média) — preço/parcela/entrada/subsídio sem ressalva →
   anexa: _"Esses valores são estimativos e ficam sujeitos à disponibilidade e à análise de crédito."_
3. **LGPD — dado sensível cedo** (alta) — pedir CPF/RG antes do estágio
   `oferta_analise|handoff|agendado` → bloqueia o envio.
4. **Insistência** (média) — ≥2 convites e ainda convidando → sinaliza.

## Resultado (ComplianceResult)
`{ approved, violations[{rule,severity,excerpt}], revisedMessage|null }`
- `approved=false` → o orquestrador zera a mensagem (não envia neste turno).
- `revisedMessage` → texto corrigido (ex.: com ressalva anexada).

## Evolução (fase Estável)
Camada LLM opcional para reescrever com naturalidade quando houver violação média.
