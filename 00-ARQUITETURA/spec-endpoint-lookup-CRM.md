# Spec p/ Manus — Endpoint de consulta de lead por telefone

## Por quê
Alguns leads se cadastram no formulário e **também mandam mensagem no WhatsApp**. Esses devem ser respondidos pelo agente. O agente precisa **comparar o telefone que mandou mensagem com os telefones já cadastrados** (forms/CRM). O CRM já tem a função `buscarLeadPorTelefone` (`server/db.ts:12252`) e a normalização em `checkLeadDuplicado` — falta só expor uma rota.

## Endpoint a criar
```
GET /api/leads/lookup?telefone={telefone}&token={TOKEN}
```
- **Auth:** o mesmo padrão dos webhooks — `token` na query (valida com `getWebhookConfigByToken`); inválido → `401 { found:false }`.
- **telefone:** vem normalizado pelo agente (sem `+55`, sem máscara), mas valide/normalize de novo por segurança (reuse a normalização do `checkLeadDuplicado`).

### Resposta
Encontrado:
```json
{ "found": true, "lead": { "id": 4329219, "nome": "João Silva", "telefone": "11999999999", "status": "novo" } }
```
Não encontrado:
```json
{ "found": false }
```

### Implementação sugerida (reaproveitando o que já existe)
```ts
// server/webhookRoutes.ts
router.get('/leads/lookup', async (req, res) => {
  const token = String(req.query.token || '');
  const cfg = await db.getWebhookConfigByToken(token);
  if (!cfg) return res.status(401).json({ found: false, error: 'Token inválido' });

  const telefone = String(req.query.telefone || '');
  if (!telefone) return res.status(400).json({ found: false });

  const lead = await db.buscarLeadPorTelefone(telefone); // ja existe em server/db.ts:12252
  if (!lead) return res.json({ found: false });
  return res.json({ found: true, lead: { id: lead.id, nome: lead.nome, telefone: lead.telefone, status: lead.status } });
});
```

## Como o agente usa
- Variável no orquestrador: `CRM_LOOKUP_PATH=/api/leads/lookup` (na Render).
- Na ENTRADA, se o telefone não foi iniciado pelo agente, ele chama esse endpoint:
  - **found:true** → trata como lead e responde normalmente (e guarda o `leadId`).
  - **found:false / erro** → ignora (não responde) — seguro contra spam/conversa antiga.

> Enquanto a Manus não expõe a rota, deixe `CRM_LOOKUP_PATH` vazio: o agente responde apenas os leads que ele iniciou (via `/intake/new-lead`). Como no Caminho A o Zapier registra todo lead do form no `/intake/new-lead`, o match já acontece por telefone no próprio agente; o endpoint do CRM é a camada extra de robustez (inbound antes do Zapier / estado perdido).
