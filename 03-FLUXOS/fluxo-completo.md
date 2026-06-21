# Fluxo Completo — do formulário ao corretor

```
1) Lead se inscreve no formulário (Facebook Lead Ads / site)
        │
        │  (Zapier/Make: dispara ao enviar o form)
        ▼
2) POST /intake/new-lead   → AGENTE registra o lead e manda a 1ª mensagem (abertura dinâmica)
        │
        ▼
3) QUALIFICAÇÃO (7 dimensões, poucas perguntas naturais)
   situação → motivação → urgência → renda → FGTS → decisor → objeção
        │
        ▼
4) AGENDAMENTO + EXPLICAÇÃO  (assim que tem objetivo + renda + região)
   - tenta agendar a visita (binário: "sábado de manhã ou domingo à tarde?")
   - explica a importância dos DOIS passos:
       • Visita: conhecer pessoalmente dá segurança pra decidir
       • Análise de crédito: confirma aprovação + subsídio/parcela (rápida, grátis, destrava tudo)
        │
        ▼
5) ESCALONAMENTO  (no 1º sinal de avanço: escolheu horário, aceitou análise,
   demonstrou intenção, ou pediu humano)
   → HANDOFF → POST {CRM}/api/webhook/lead/{TOKEN}
   → CRM faz a ROLETA, atribui e NOTIFICA o corretor
   → agente PARA de conduzir (corretor confirma visita e faz a análise)
```

## O que já está pronto (no código) ✅
- `/intake/new-lead` (porta de entrada do lead → 1ª mensagem)
- Qualificação pelas 7 dimensões + estilo SMQ (guia injetado no cérebro)
- Fase de agendamento + explicação da importância de visita e análise (no system-prompt)
- Handoff → roleta do CRM (escalonamento)
- Travas: ignora grupos, só responde lead de verdade, anti-loop, opt-out, horário
- Pausar/retomar/reset lead (admin) + abertura dinâmica + teste e2e (8/8)

## O que falta WIRAR (configuração, não código) 🔧
1. **Formulário → agente**: no Zapier/Make, gatilho "novo lead do Facebook Lead Ads" → ação `POST https://SUA-URL/intake/new-lead` com `{phone, nome, empreendimento, faixaRenda, objetivo}`.
2. **Roleta**: setar `CRM_TOKEN` (token da campanha) na Render — sem ele, o handoff usa a roleta local em vez do CRM.
3. **Webhook Z-API**: apontado pra `/webhook/zapi` (já feito) — é o que traz as respostas do lead.

## Observações
- O agente **tenta agendar e explica**, mas **não fecha data definitiva nem faz a análise** — isso é do corretor (ele recebe o lead já qualificado e aquecido).
- "Sinal de avanço" é amplo de propósito (aceitou visita OU análise OU intenção OU pediu humano) pra não perder o lead quente.
- Enfático, **nunca insistente**: máx. 2 tentativas; respeita "agora não" e vira follow-up.
