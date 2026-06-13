# Integração — Z-API

A Z-API é uma API **não-oficial** (conecta via uma instância do WhatsApp, lendo o QR Code como o WhatsApp Web). É barata, rápida de subir e não exige aprovação de template — mas **carrega risco de bloqueio** se usada para disparo frio em massa. Por isso, no nosso desenho ela é **secundária**.

## Quando usar a Z-API (e quando NÃO)

✅ **Pode usar para:**
- Responder conversas que **o cliente iniciou** (ele te mandou mensagem primeiro).
- Janela conversacional de leads já engajados.
- Número secundário de menor volume / testes.

❌ **Não use para:**
- Primeiro contato frio em massa (isso é trabalho da API oficial com template).
- Disparar listas grandes de uma vez.
- Mensagens idênticas para muitos números.

## Setup

1. Criar conta na Z-API e uma **instância**.
2. Conectar lendo o **QR Code** com o número do agente (idealmente o número secundário, não o seu pessoal).
3. Pegar `INSTANCE_ID`, `INSTANCE_TOKEN` e o `Client-Token` da conta.
4. Configurar o **webhook de mensagens recebidas** apontando para o orquestrador.

## Exemplos de chamada

### Enviar texto
```bash
curl -X POST "https://api.z-api.io/instances/<INSTANCE_ID>/token/<INSTANCE_TOKEN>/send-text" \
 -H "Client-Token: <CLIENT_TOKEN>" \
 -H "Content-Type: application/json" \
 -d '{
   "phone": "5511999999999",
   "message": "Perfeito! Me conta: é seu primeiro imóvel?"
 }'
```

### Webhook de mensagem recebida (payload simplificado)
```json
{
  "phone": "5511999999999",
  "text": { "message": "tem 2 quartos?" },
  "fromMe": false,
  "momment": 1718900000000
}
```

## Travas anti-bloqueio específicas da Z-API

- **Atraso humano** entre mensagens (3–15s aleatório) — a Z-API tem parâmetro de delay; use.
- **Volume baixo e constante**, sem rajadas.
- **Aquecer o número** antes (conversas reais, receber e responder) por alguns dias.
- **Respeitar opt-out** igual à oficial.
- Manter **conteúdo variado** (o agente já varia naturalmente).
- Se o número começar a cair em "verificação"/desconexões frequentes → reduzir volume e migrar o frio 100% para a oficial.

> Recomendação final: **frio = oficial; morno/quente respondendo = qualquer um dos dois**. Assim você aproveita a Z-API sem expor o número a banimento.
