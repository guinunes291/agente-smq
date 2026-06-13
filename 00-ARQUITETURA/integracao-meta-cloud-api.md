# Integração — Meta WhatsApp Cloud API (oficial)

Use esta via para **primeiro contato frio** e como canal principal. É a mais segura contra bloqueio.

## Passo a passo de setup

1. **Conta Meta Business** (business.facebook.com) verificada (Business Verification — pode pedir CNPJ e documentos).
2. **App no Meta for Developers** (developers.facebook.com) → adicionar produto **WhatsApp**.
3. **Número dedicado** ao agente (não use seu número pessoal/atual). Pode ser um chip novo ou número fixo. Uma vez na API oficial, esse número **não** funciona mais no app comum.
4. Pegar as credenciais:
   - `PHONE_NUMBER_ID`
   - `WABA_ID` (WhatsApp Business Account ID)
   - `ACCESS_TOKEN` (gere um **token permanente** via System User, não o token temporário de 24h)
5. Configurar o **Webhook** (URL do seu orquestrador) e assinar o evento `messages`. Verifique o token de verificação.
6. Submeter **templates de mensagem (HSM)** para aprovação (ver `04-MENSAGENS/templates-mensagens.md`). Aprovação leva de minutos a 24h.

## Conceitos que mandam na operação

- **Janela de 24h (Customer Service Window):** depois que o cliente te manda uma mensagem, você tem 24h para responder com **texto livre**. Fora dessa janela, só **template aprovado**.
- **Templates (HSM):** mensagens pré-aprovadas, em categorias `MARKETING`, `UTILITY` ou `AUTHENTICATION`. Primeiro contato de lead = normalmente `MARKETING` ou `UTILITY`.
- **Conversation pricing / tiers:** cobrança por conversa iniciada; tiers de volume sobem com Quality Rating.

## Exemplos de chamada (REST)

### Enviar template (1º contato, fora da janela)
```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
 -H "Authorization: Bearer <ACCESS_TOKEN>" \
 -H "Content-Type: application/json" \
 -d '{
   "messaging_product": "whatsapp",
   "to": "5511999999999",
   "type": "template",
   "template": {
     "name": "primeiro_contato_lead",
     "language": { "code": "pt_BR" },
     "components": [
       { "type": "body",
         "parameters": [
           { "type": "text", "text": "Henrico" },
           { "type": "text", "text": "Vibra Sabará" }
         ] }
     ]
   }
 }'
```

### Responder texto livre (dentro da janela de 24h)
```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
 -H "Authorization: Bearer <ACCESS_TOKEN>" \
 -H "Content-Type: application/json" \
 -d '{
   "messaging_product": "whatsapp",
   "to": "5511999999999",
   "type": "text",
   "text": { "body": "Perfeito! Com a sua renda dá pra usar o subsídio do MCMV..." }
 }'
```

### Webhook recebendo mensagem (payload simplificado)
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "text": { "body": "Quero com 2 quartos" },
          "timestamp": "1718900000"
        }]
      }
    }]
  }]
}
```
→ O orquestrador recebe isso, manda para o LLM com o `system-prompt.md` + contexto, e responde.

## Boas práticas específicas da oficial

- Gere **token permanente** (System User) — token temporário expira em 24h e derruba a operação.
- Mantenha o **Quality Rating** verde: monitore no WhatsApp Manager.
- Não misture marketing agressivo: a Meta penaliza alto índice de bloqueios/denúncias dos usuários.
- Tenha o template de **opt-out** e respeite-o (ver guardrails).
