# Fluxo do Orquestrador (ponta a ponta)

## Visão geral

```
                         ┌──────────────────────────────────────┐
   Lead novo (anúncio)   │  POST /outbound/first-contact         │
        │                │  -> Meta sendTemplate (HSM aprovado)  │
        ▼                └──────────────────────────────────────┘
   Lead responde
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  WEBHOOK  (POST /webhook/meta  ou  /webhook/zapi)             │
│   parseInbound -> { channel, from, name, text, ts }          │
└───────────────────────────────┬──────────────────────────────┘
                                ▼
                       handleInbound(inbound)            [processor.js]
                                │
   ┌────────────────────────────┼─────────────────────────────────┐
   │ 1. opt-out? (SAIR/PARAR) ──┼─► OPT_OUT + confirma + encerra   │
   │ 2. já em handoff? ─────────┼─► registra e NÃO reconduz        │
   │ 3. push history (user)     │                                  │
   │ 4. runAgent() ─────────────┼─► Anthropic + system-prompt +    │
   │                            │   contexto (empreendimentos,     │
   │                            │   corretor, regras MCMV)         │
   │ 5. aplica estado/temperatura                                  │
   │ 6. executa ações: SALVAR_LEAD / AGENDAR / HANDOFF / OPT_OUT   │
   │ 7. rate-limit diário (anti-spam)                              │
   │ 8. atraso humano + envia resposta (canal de origem)          │
   └──────────────────────────────────────────────────────────────┘
                                │
                 (cliente aceita análise / confirma visita / pede humano)
                                ▼
                        HANDOFF  [tools.js]
                  - escolhe corretor (empreendimento -> região -> fallback)
                  - notifica corretor (card) via WhatsApp/log
                  - grava no CRM, marca lead.handoff = true
                  - agente PARA de conduzir
```

## Decisão de canal

- **Primeiro contato frio** → sempre `POST /outbound/first-contact` (Meta, template HSM). Nunca texto livre frio.
- **Resposta dentro da janela de 24h** → canal definido em `REPLY_CHANNEL` (meta ou zapi). O `processor` responde pelo **mesmo canal** que recebeu (`inbound.channel`).

## Travas anti-spam aplicadas no fluxo

| Trava | Onde | Como |
|-------|------|------|
| Opt-out | `guards.isOptOutMessage` + passo 1 | SAIR/PARAR encerra na hora |
| Janela 24h | `state.within24h` | fora da janela, só template |
| Horário comercial | `guards.isBusinessHours` | só para disparos de iniciativa |
| Rate limit/dia | `guards.rateLimitOk` (passo 7) | `MAX_MESSAGES_PER_LEAD_PER_DAY` |
| Atraso humano | `guards.humanDelay` (passo 8) | 3–12s aleatório |
| Variação de conteúdo | LLM | o agente reescreve naturalmente |
| Anti-insistência | system-prompt + `convitesAnaliseVisita` | máx. 2 convites |

## Regra de negócio central (handoff)

O passo 6 executa `HANDOFF` **assim que** o agente marca `handoff:true` (cliente aceitou análise, confirmou visita ou pediu humano). A partir daí o passo 2 garante que o agente **não reconduz** a venda — quem assume é o corretor responsável.

## Estados do lead (`estagio`)

`primeiro_contato → qualificando → oferta_analise | oferta_visita → handoff → (corretor assume)` · `encerrado` (opt-out)

## O que plugar para produção

- **State/CRM**: hoje em arquivo (`data/state.json`, `data/leads.csv`). Trocar por Redis + CRM real (HubSpot/RD/PipeRun).
- **AGENDAR**: integrar com Google Calendar / agenda do corretor.
- **HANDOFF notify**: setar `HANDOFF_NOTIFY_CHANNEL=meta|zapi` e telefones reais no `corretores.csv`.
- **Fila**: para volume alto, processar `handleInbound` via fila (BullMQ) em vez de inline.
