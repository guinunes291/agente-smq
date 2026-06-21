# Passo a passo — n8n: Formulário (Facebook Lead Ads) → Agente

Objetivo: quando o lead preenche o formulário, o n8n envia ao **agente** (`/intake/new-lead`), que faz o 1º contato e qualifica. (Mesmo papel do Zapier, alternativa sem custo de "Webhooks premium".)

## Pré-requisitos
- Conta n8n (n8n.cloud ou self-hosted).
- App/login do Facebook com acesso de admin à Página e ao formulário.

## Workflow (2 nós)

### Nó 1 — Trigger: "Facebook Lead Ads Trigger"
1. New Workflow → **Add first step** → busque **Facebook Lead Ads Trigger**.
2. **Credential**: conecte a conta do Facebook (OAuth). Dê acesso à Página.
3. **Page**: selecione a Página do anúncio.
4. **Form**: selecione o formulário (lead gen form) da campanha.
5. **Listen for test event** → envie um lead de teste pelo formulário (ou use o "Lead Ads Testing Tool" do Facebook) → o n8n captura os campos (full_name, phone_number, email, e os campos do form).

### Nó 2 — "HTTP Request" (POST pro agente)
1. **Add node** → **HTTP Request**.
2. Configure:
   - **Method**: `POST`
   - **URL**: `https://agente-qualificacao-smq.onrender.com/intake/new-lead`
   - **Send Body**: `ON`
   - **Body Content Type**: `JSON`
   - **Specify Body**: `Using Fields Below` (ou JSON):
     | Name | Value (expressão) |
     |------|-------------------|
     | `phone` | `{{ $json.phone_number }}` |
     | `nome` | `{{ $json.full_name }}` |
     | `email` | `{{ $json.email }}` |
     | `faixaRenda` | `{{ $json["faixa_de_renda"] }}` (use o nome real do campo do form) |
     | `objetivo` | `{{ $json["voce_pretende_utilizar_o_imovel_para"] }}` |
     | `empreendimento` | `{{ $json.campaign_name }}` (ou o nome do empreendimento) |
     | `origem` | `fb_ads` |
   - **Headers**: `Content-Type` = `application/json`
3. **Execute node** para testar → resposta esperada `{"ok":true,"canal":"zapi","enviado":true}`; o lead de teste recebe a 1ª mensagem.

### Ativar
- Salve e **Active** (toggle no topo). Pronto: novos leads do formulário caem no agente.

## Observações
- **Telefone**: não precisa formatar — o agente já normaliza (tira "+", espaços e garante o DDI 55) tanto no envio quanto no match das respostas.
- **Nomes dos campos do form**: confira como aparecem no "test event" (etapa 5) e use esses nomes nas expressões.
- **Não duplicar**: garanta que o formulário do Facebook **não** está mandando também direto pro webhook de distribuição do CRM ao mesmo tempo — senão o corretor recebe antes da qualificação. (O CRM deve receber só no handoff.)
- **Mapear projeto por campanha**: se cada campanha = um empreendimento, dá pra mapear `empreendimento` por um nó **Set/Switch** conforme o `campaign_name`, garantindo o nome certo do projeto.
