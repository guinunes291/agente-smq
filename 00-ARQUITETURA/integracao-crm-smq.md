# Integração — CRM Seu Metro Quadrado (seumetroquadrado.click)

## Fluxo CORRETO (agente primeiro, corretor depois)

> Regra do negócio: **o lead vai primeiro para o AGENTE. Só depois de qualificado é que vai para o corretor** (via roleta do CRM).

```
FB Ads → CRM cria o lead
   → CRM chama o AGENTE:  POST /intake/new-lead   (NÃO distribui pro corretor ainda)
   → Agente faz o 1º contato e QUALIFICA no WhatsApp
   → No aceite (análise/visita) o agente faz o HANDOFF:
        POST {CRM}/api/webhook/facebook/{TOKEN}  (lead qualificado)
        → CRM faz a ROLETA, atribui e NOTIFICA o corretor
        → resposta: { success, leadId, corretorId, distribuido }
   → Agente encerra a condução (não reconduz a venda)
```

### O que muda no CRM (configuração do lado da Manus)
Hoje o lead do FB já cai no CRM e é distribuído na entrada. Para o "agente primeiro", o CRM precisa, ao receber um lead novo de campanha, **chamar o agente** (`POST https://SUA-URL/intake/new-lead`) em vez de (ou antes de) distribuir ao corretor. A distribuição passa a acontecer quando o **agente devolve o lead qualificado** no endpoint de webhook do CRM.

> Se preferir não mexer no CRM agora: aponte o **webhook do Facebook Lead Ads** direto para `POST /intake/new-lead` do agente. O agente qualifica e, no handoff, chama o endpoint do CRM para distribuir. Assim o CRM continua sendo o "distribuidor", só que acionado no fim.

---

## Endpoints do CRM (do briefing)

| Fila | URL |
|------|-----|
| Roleta normal | `POST {BASE}/api/webhook/facebook/{TOKEN}` |
| Fila Foco (sem limite diário) | `POST {BASE}/api/webhook/facebook-foco/{TOKEN}` |

- **Base:** `https://seumetroquadrado.click`
- **Auth:** o **token vai na URL** (sem header Bearer). Token inválido → `401 {success:false}`.
- **Body (recomendado):** `{ "nome", "telefone", "email", "faixaRenda", "finalidadeImovel", "prefereContatoPor", "projectId" }`
- **Resposta:** `{ "success":true, "leadId":123, "corretorId":456, "distribuido":true }`
- `distribuido:false` → criado mas sem corretor disponível; o CRM redistribui a cada 5 min.

### Tokens por campanha
Cada campanha tem seu token (configurável em **Gestão → Configurar Webhook** no CRM). O token é **secreto** — vai na env `CRM_TOKEN`, nunca no código.

---

## Configuração no orquestrador (env)

| Variável | Valor |
|----------|-------|
| `CRM_BASE_URL` | `https://seumetroquadrado.click` |
| `CRM_QUEUE` | `normal` (roleta) ou `foco` (fila sem limite) |
| `CRM_TOKEN` | token da campanha (secreto) |

Com `CRM_TOKEN` preenchido, o handoff usa o CRM (roleta + notificação do corretor são do CRM).
Sem token, o agente cai na **roleta local** (`corretores.csv`) e notifica o corretor pela Z-API.

### Mapeamento de campos (agente → CRM)
- `telefone`: o agente remove o DDI `55` (envia no formato `11999999999`).
- `finalidadeImovel`: `morar` → `moradia`; `investir` → `investimento`.
- `prefereContatoPor`: `WhatsApp`.
- `projectId`: id **numérico** do projeto no CRM (se você mapear os empreendimentos para esses ids; opcional).

---

## Pontos em aberto (para confirmar com a Manus)
1. O CRM consegue, ao receber lead novo, **chamar o agente** (`/intake/new-lead`) em vez de distribuir na hora? (necessário para "agente primeiro").
2. Existe um id **numérico** de projeto (`projectId`) por empreendimento, para o agente enviar e o lead já cair no funil certo?
3. O endpoint de webhook aceita **reenvio** do mesmo lead já qualificado (com os campos extras) sem duplicar? (idempotência).
