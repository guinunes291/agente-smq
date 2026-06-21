# Passo a passo — Zapier: Formulário (Facebook Lead Ads) → Agente

Objetivo: quando um lead preenche o formulário, o **agente recebe primeiro** (faz o 1º contato e qualifica). Só depois, no handoff, o lead entra no CRM/roleta.

> Observação: "Webhooks by Zapier" é recurso de plano **pago** do Zapier. Se preferir sem custo, dá pra usar o **Make (Integromat)** — os passos são equivalentes (gatilho Facebook Lead Ads → módulo HTTP POST).

---

## ETAPA 1 — Criar o Zap e o gatilho (Trigger)
1. Em zapier.com → **Create → Zap**.
2. **Trigger**: busque **Facebook Lead Ads**.
3. **Event**: `New Lead` → Continue.
4. **Account**: conecte a conta do Facebook (precisa ser admin da Página).
5. **Trigger setup**:
   - **Page**: selecione a Página do anúncio.
   - **Form**: selecione o formulário (lead gen form) da campanha.
6. **Test trigger**: o Zapier puxa um lead de exemplo. Confira que aparecem os campos (nome, telefone, email, e os campos do form: faixa de renda, finalidade, etc.).

## ETAPA 2 — (Recomendado) Formatar o telefone
O Facebook costuma mandar o telefone como `+55 11 99999-9999`. O agente precisa só dos dígitos com DDI 55.
1. **+ → Action → Formatter by Zapier**.
2. **Event**: `Numbers → Format Phone Number` (ou `Text → Replace` removendo tudo que não é dígito).
3. Entrada: o campo `Phone Number` do passo 1.
4. Saída desejada: só dígitos, ex.: `5511999999999`. (Se usar Replace, troque tudo que não for número por vazio e garanta o `55` na frente.)

## ETAPA 3 — Enviar pro agente (Webhooks by Zapier)
1. **+ → Action → Webhooks by Zapier**.
2. **Event**: `POST` → Continue.
3. **Setup**:
   - **URL**: `https://agente-qualificacao-smq.onrender.com/intake/new-lead`
   - **Payload Type**: `JSON`
   - **Data** (chave → valor, mapeando os campos do passo 1/2):
     | Chave | Valor |
     |-------|-------|
     | `phone` | telefone formatado (etapa 2) — só dígitos com 55 |
     | `nome` | Full Name |
     | `email` | Email |
     | `faixaRenda` | campo "faixa de renda" do form |
     | `objetivo` | campo "finalidade do imóvel" (morar/investir) |
     | `empreendimento` | nome da campanha/anúncio ou do empreendimento |
     | `origem` | `fb_ads` (valor fixo) |
   - **Wrap Request In Array**: `No`
   - **Unflatten**: `Yes` (padrão)
   - **Headers**: `Content-Type` = `application/json`
4. **Test action**: o Zapier faz o POST de verdade.
   - Resposta esperada: `{"ok":true,"canal":"zapi","enviado":true}`
   - O lead de teste recebe a 1ª mensagem no WhatsApp.

## ETAPA 4 — Publicar
1. Renomeie o Zap (ex.: "FB Lead → Agente SMQ").
2. **Publish / Turn on Zap**.

---

## ⚠️ Evitar lead duplicado / "corretor antes do agente"
Hoje o lead do Facebook **já cai direto no CRM** (que distribui na hora). Se você ligar este Zap **sem mexer no CRM**, o lead vai pros dois — e o corretor recebe antes da qualificação (o oposto do que queremos).

Escolha uma das opções:
- **(Preferido) Reapontar o Facebook para o agente:** no painel do Facebook/CRM, faça o formulário enviar para o **agente** (este Zap), e **não** mais direto pro webhook de distribuição do CRM. O CRM passa a receber o lead **no handoff** (após qualificação), via roleta.
- **(Alternativa) Manter o CRM recebendo, mas sem distribuir na entrada:** pedir à Manus o "modo agente" (criar o lead sem distribuir e chamar o agente). É a opção mais robusta a longo prazo (descrita em `analise-crm-manus.md`).

> Enquanto isso não é decidido, dá pra testar o Zap apontando para um **formulário/campanha de teste** (sem afetar a produção).

## Campos do formulário (confirmar nomes reais)
Os nomes dos campos no Facebook variam conforme o form. No "test trigger" (etapa 1), anote como aparecem (ex.: `faixa_de_renda`, `você_pretende_utilizar_o_imóvel_para`) e use esses no mapeamento da etapa 3.
