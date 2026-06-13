# Deploy & Ativação — passo a passo

> O que **eu já deixei pronto**: código testado, `Dockerfile`, `render.yaml` (deploy automático), `.env.example` e este guia.
> O que **só você pode fazer** (por segurança eu não crio contas nem digito suas chaves): criar as contas, gerar as credenciais e colá-las no painel do provedor. Eu te guio em cada clique.

---

## Visão geral (5 etapas)

1. Subir o código para um repositório (GitHub).
2. Criar o serviço na **Render** a partir do `render.yaml`.
3. Colar as credenciais (secrets) no painel da Render.
4. Configurar os **webhooks** na Meta e na Z-API apontando para a URL da Render.
5. Aprovar os **templates** na Meta e fazer o teste-piloto.

---

## ETAPA 1 — Subir o código (GitHub)

1. Crie um repositório privado em https://github.com/new (ex.: `agente-smq`).
2. Suba a pasta **inteira** `Agente-Qualificacao-SMQ/` (o `render.yaml` fica na raiz dela).
   - Pelo site do GitHub: "Add file → Upload files" e arraste a pasta. (Ou `git init && git add . && git commit && git push` se usar terminal.)
3. O `.gitignore` já evita subir `node_modules`, `.env` e dados — ótimo.

## ETAPA 2 — Criar o serviço na Render

1. Crie conta em https://render.com (pode entrar com o GitHub).
2. **New → Blueprint** → conecte o repositório `agente-smq`.
3. A Render lê o `render.yaml` e propõe o serviço `agente-qualificacao-smq`. Clique **Apply**.
4. Aguarde o primeiro build (Docker). Vai falhar/ficar "unhealthy" até você preencher os secrets — normal.

## ETAPA 3 — Colar as credenciais (Render → Environment)

No serviço criado, vá em **Environment** e preencha as variáveis marcadas como *secret* (lista e onde pegar logo abaixo). Salve → a Render redeploya. Quando o `/health` responder, está no ar. Sua URL será algo como `https://agente-qualificacao-smq.onrender.com`.

## ETAPA 4 — Configurar os webhooks

**Meta (oficial):** Painel do app em https://developers.facebook.com → seu app → **WhatsApp → Configuration → Webhook**:
- Callback URL: `https://SUA-URL.onrender.com/webhook/meta`
- Verify Token: o mesmo valor que você pôs em `META_VERIFY_TOKEN`
- Clique **Verify and Save** e **assine o campo `messages`**.

**Z-API (secundário):** Painel da instância em https://app.z-api.io → **Webhooks → Ao receber**:
- URL: `https://SUA-URL.onrender.com/webhook/zapi`

## ETAPA 5 — Templates + teste-piloto

1. Aprove os templates de `04-MENSAGENS/templates-mensagens.md` em **WhatsApp Manager → Modelos de mensagem** (`primeiro_contato_lead`, `reativacao_base`).
2. Teste o primeiro contato (troque a URL e o número):
   ```bash
   curl -X POST https://SUA-URL.onrender.com/outbound/first-contact \
    -H "Content-Type: application/json" \
    -d '{"phone":"5511999999999","nome":"Teste","empreendimento":"Vibra Sabará","origem":"piloto"}'
   ```
3. Responda do seu WhatsApp e veja o agente conduzir → qualificar → ofertar análise/visita → **handoff**.
4. Acompanhe o Quality Rating no WhatsApp Manager e siga o `05-OPERACAO/checklist-go-live.md`.

---

## CREDENCIAIS QUE EU PRECISO QUE VOCÊ OBTENHA (e onde)

> ⚠️ Segurança: **cole esses valores direto no painel da Render** (Environment), não aqui no chat. Me mande só os **IDs não-secretos** se quiser que eu confira algo (ex.: Phone Number ID). Nunca me mande a API key nem tokens.

| Variável | O que é | Onde conseguir |
|----------|---------|----------------|
| `ANTHROPIC_API_KEY` | chave do cérebro (LLM) | https://console.anthropic.com → **API Keys → Create Key** |
| `ANTHROPIC_MODEL` | modelo a usar | confirme o nome em https://console.anthropic.com (ex.: `claude-sonnet-4-6`) |
| `META_PHONE_NUMBER_ID` | ID do número na Cloud API | developers.facebook.com → seu app → **WhatsApp → API Setup** |
| `META_ACCESS_TOKEN` | token permanente | Meta Business → **System Users → gerar token permanente** com permissões `whatsapp_business_messaging` e `whatsapp_business_management` |
| `META_VERIFY_TOKEN` | senha que você inventa | você escolhe (ex.: `smq-2026-xyz`) e repete no webhook da Meta |
| `ZAPI_INSTANCE_ID` | ID da instância | painel Z-API (app.z-api.io) → sua instância |
| `ZAPI_INSTANCE_TOKEN` | token da instância | painel Z-API → sua instância |
| `ZAPI_CLIENT_TOKEN` | token de segurança da conta | painel Z-API → **Segurança / Account Security** |
| `FALLBACK_CORRETOR_PHONE` | número do plantonista (DDI) | você define, ex.: `5511999999999` |

**Pré-requisitos de conta (uma vez):**
- **Meta Business verificado** (business.facebook.com → Configurações → Verificação do negócio) — pode pedir CNPJ.
- **Número dedicado** ao agente na Cloud API (não o seu número atual; ao entrar na API oficial ele sai do app comum).

### Me diga / confirme comigo
Para eu finalizar a configuração e o teste com você, me confirme (sem secrets):
1. Você prefere **Render** (o que preparei) ou outro provedor (Railway/Fly/VPS)?
2. Já tem **número dedicado** para o agente, ou vai usar a Z-API com um número novo primeiro?
3. Quer que o primeiro contato saia pela **API oficial** desde já (precisa template aprovado) ou começamos respondendo só quem te chama (Z-API) enquanto a oficial é aprovada?

Assim que os secrets estiverem na Render e os webhooks apontados, o agente está **no ar**. Eu te acompanho no teste-piloto e ajusto o que precisar.
