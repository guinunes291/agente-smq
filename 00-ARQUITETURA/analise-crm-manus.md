# Análise do CRM (repositório Manus) — para a integração "agente primeiro"

Repositório analisado: `guinunes291/c-pia-de-seu-metro-quadrado---crm-imobili-rio` (TypeScript, server + client, Drizzle ORM).

## Como o CRM funciona HOJE (verificado no código)

- **Webhooks de entrada** (`server/webhookRoutes.ts`):
  - `POST /api/webhook/facebook/:token` — recebe lead do FB (formato leadgen ou JSON simples).
  - `POST /api/webhook/facebook-foco/:token` — idem, fila Foco.
  - `POST /api/webhook/lead/:token` — genérico, aceita vários aliases de campo (nome/telefone/email/faixa de renda…).
- Todos chamam **`processarLeadWebhook`** (`server/db.ts:3746`), que faz, **na entrada e de uma vez só**:
  1. `createLead(...)` (status `novo`).
  2. **`distribuirLeadPelaRoleta(leadId)`** (`server/db.ts:3562`) — roleta com 2 filas: **Foco** (sem limite) e **Geral** (com limite diária). Atribui corretor, status `aguardando_atendimento`, ativa timer p/ leads de ADS.
  3. **Notifica o corretor** via Zapier (WhatsApp) + push notification.
- ⇒ **Comportamento atual = "corretor primeiro"** (distribui antes de qualquer qualificação). É o que você quer mudar.

## Dois achados que mandam na integração

1. **Guard de duplicado:** `createLead` (`server/db.ts:957`) chama `checkLeadDuplicado(telefone, email, cpf)` e **lança "Lead duplicado"**. ⇒ O agente **não pode reenviar** o mesmo lead no webhook no handoff — o CRM recusaria. O lead deve entrar no CRM **uma única vez**.
2. **O CRM já tem um conceito de chatbot de pré-qualificação** (`server/db/chatbot.ts`): `createConversaChatbot`, `addMensagemChatbot`, `converterConversaEmLead` (rota tRPC em `server/routers.ts:4119`). Ou seja, a estrutura "qualifica antes, vira lead depois" **já existe**. Porém `converterConversaEmLead` **não** roda a roleta (só grava o corretorId que você passar).

## Resposta à sua pergunta
**Sim, dá pra fazer "agente primeiro".** A roleta continua sendo do CRM; só muda **quando** ela é acionada (no handoff, não na entrada). Dois caminhos:

### Caminho A — Repontar o Facebook para o agente (sem mexer no CRM)
```
FB Lead Ads → AGENTE (/intake/new-lead) → qualifica
   → handoff → POST {CRM}/api/webhook/lead/{TOKEN} → cria + roleta + notifica corretor
```
- **Zero mudança no CRM.** O lead entra no CRM só no handoff (1 vez) → sem duplicado.
- Como o FB manda só o `leadgen_id`, o mais simples é colocar um **Zapier/Make** no meio (vocês já usam Zapier): FB Lead Ads → formata → `POST /intake/new-lead` com os campos. Sem precisar de código de Graph API no agente.
- Trade-off: lead que **não qualifica não fica registrado** no CRM.

### Caminho B — Pequena mudança no CRM (recomendado p/ registrar tudo)
Peça à Manus 2 ajustes:
1. **Config de webhook com "modo agente"**: um flag (`enviarParaAgente` + `agenteUrl`) em `webhookConfig`. Em `processarLeadWebhook`, quando ligado: **cria o lead (status `novo`), NÃO chama `distribuirLeadPelaRoleta` nem notifica corretor**, e faz `POST {agenteUrl}/intake/new-lead` com `{ leadId, nome, telefone, projectId, ... }`.
2. **Endpoint para distribuir um lead JÁ existente**: `POST /api/leads/:id/distribuir` que chama `distribuirLeadPelaRoleta(id)` + notifica corretor + salva os campos de qualificação. O agente chama **isso** no handoff (com o `leadId` recebido na entrada). Sem duplicado, e a roleta roda só após a qualificação.
- Resultado: todo lead fica no CRM, o agente qualifica primeiro, e o corretor só recebe lead qualificado. Caminho mais limpo a longo prazo.

## Recomendação
- **Para subir o piloto JÁ:** Caminho A (FB → agente via Zapier → handoff cria no CRM). Nada de mexer no CRM.
- **Para a operação definitiva:** Caminho B (2 ajustes pequenos na Manus). O agente já está pronto pra receber `leadId` na entrada e usar no handoff — é só a Manus expor o endpoint de "distribuir existente".

## Observação
A notificação ao corretor hoje é via **Zapier (WhatsApp)** (`ZAPIER_WHATSAPP_SETUP.md` + `server/zapierWebhook.ts`). No nosso desenho, quem dispara isso é o CRM (na distribuição) — o agente não precisa duplicar.
