# Orquestrador — Agente de Qualificação SMQ

Servidor Node.js que conecta WhatsApp (Meta Cloud API + Z-API) ao cérebro Anthropic, usando a base de conhecimento em `../02-BASE-CONHECIMENTO` e o prompt em `../01-CONTEXTO-AGENTE/system-prompt.md`.

## Requisitos
- Node.js 18+ (testado no 22)
- Conta Anthropic (API key)
- Meta WhatsApp Cloud API (número dedicado) e/ou Z-API

## Instalação
```bash
cd orquestrador
cp .env.example .env      # preencha as variáveis
npm install
npm start                 # produção
# ou
npm run dev               # com --watch
```

## Teste local (sem credenciais)
```bash
npm run test:local
```
Valida o carregamento da base, o fluxo de processamento, o handoff e o opt-out usando um *stub* do agente (não chama a API). Saída esperada termina com `Fluxo executou sem erros`.

## Estrutura
```
orquestrador/
├── package.json
├── .env.example
├── README-orquestrador.md
├── flow/fluxo-orquestrador.md     ← diagrama do fluxo
└── src/
    ├── index.js          ← Express + webhooks Meta/Z-API + disparo de 1º contato
    ├── processor.js      ← handleInbound (orquestra tudo, ponta a ponta)
    ├── agent.js          ← cérebro: monta prompt, chama Anthropic, parseia JSON
    ├── knowledge.js      ← carrega empreendimentos.csv / corretores.csv / regras / faq
    ├── tools.js          ← ações: SALVAR_LEAD, AGENDAR, HANDOFF, OPT_OUT
    ├── state.js          ← estado por lead (arquivo; troque por Redis/DB)
    ├── guards.js         ← anti-spam: opt-out, horário, rate limit, atraso humano
    ├── crm.js            ← grava leads em data/leads.csv
    ├── config.js         ← variáveis de ambiente
    ├── test-local.js     ← teste sem credenciais
    └── whatsapp/
        ├── meta.js       ← Meta Cloud API (sendText, sendTemplate, parseInbound)
        ├── zapi.js       ← Z-API (sendText, parseInbound)
        └── send.js       ← roteia o envio pelo canal certo
```

## Endpoints
| Método | Rota | Uso |
|--------|------|-----|
| GET | `/health` | healthcheck |
| GET | `/webhook/meta` | verificação do webhook Meta (hub.challenge) |
| POST | `/webhook/meta` | recebe mensagens (Meta) |
| POST | `/webhook/zapi` | recebe mensagens (Z-API) |
| POST | `/outbound/first-contact` | dispara 1º contato via template HSM |

### Exemplo: disparar primeiro contato
```bash
curl -X POST http://localhost:3000/outbound/first-contact \
 -H "Content-Type: application/json" \
 -d '{"phone":"5511999999999","nome":"Henrico","empreendimento":"Vibra Sabará","origem":"meta_ads"}'
```

## Configurar os webhooks
- **Meta**: no painel do app (WhatsApp > Configuration), aponte o Callback URL para `https://SEU_DOMINIO/webhook/meta`, use o `META_VERIFY_TOKEN` do `.env`, e assine o campo `messages`.
- **Z-API**: no painel da instância, configure o webhook "ao receber" para `https://SEU_DOMINIO/webhook/zapi`.
- Em desenvolvimento, exponha a porta com um túnel (ex.: `ngrok http 3000`).

## Modelo da Anthropic
Defina `ANTHROPIC_MODEL` no `.env`. Confirme o nome exato disponível na sua conta (ex.: `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5`). Sonnet costuma ser o melhor custo/qualidade para esse caso.

## Caminho para produção (resumo)
1. Preencher `empreendimentos.csv` e `corretores.csv` reais.
2. Submeter e aprovar os templates HSM na Meta.
3. Trocar `state.json`/`leads.csv` por Redis + CRM real.
4. Integrar `AGENDAR` à agenda do corretor (Google Calendar).
5. Setar `HANDOFF_NOTIFY_CHANNEL` para notificar o corretor de verdade.
6. Rodar o piloto (5–10 leads), checar Quality Rating, depois escalar com warmup.

> Segurança: nunca versione o `.env`. Use variáveis de ambiente do provedor (Render/Railway/Fly/AWS).
