# Integração dos Agentes dentro do CRM SMQ

Objetivo: os corretores acionam **todos os agentes** (qualificação, análise de crédito, conferente de documentação, preparador de visita, curador de imóveis, gerador de documentos, etc.) **de dentro do CRM** (seumetroquadrado.click), com os agentes lendo/gravando na base real (leads, projetos, históricos) e integrados à roleta.

---

## 1. Visão geral (o "Agent Hub")

```
              CRM (seumetroquadrado.click — Manus)
   ┌───────────────────────────────────────────────────────┐
   │  UI: painel "Agentes IA" na tela do lead/projeto      │
   │   - corretor escolhe o agente e conversa              │
   │  Backend do CRM:                                      │
   │   - /api/agents/proxy  (autentica corretor + RBAC)    │
   │   - read endpoints: lead, projeto, historico, estoque │
   │   - roleta (ja existe) + chatbot module (ja existe)   │
   └───────────────┬───────────────────────────────────────┘
                   │  POST {agentId, corretorId, leadId, projectId, input, sessionId}
                   ▼
   ┌───────────────────────────────────────────────────────┐
   │  AGENT HUB  (nosso servico Node — evolui o orquestrador)│
   │   - registry de agentes (id -> prompt + tools + model) │
   │   - memoria de sessao por (corretor, agente, lead)     │
   │   - TOOLS que leem/escrevem no CRM:                    │
   │       getLead, getProjeto, getHistorico,              │
   │       buscarEstoque, salvarDocumento, distribuirRoleta │
   └───────────────┬───────────────────────────────────────┘
                   │  chama a API da Anthropic (cerebro)
                   ▼
              Resposta do agente -> CRM exibe e (opcional) salva no historico do lead
```

**Princípio:** o **CRM é o sistema de verdade** (dados, RBAC, UI). O **Agent Hub é o cérebro** (prompts + LLM + ferramentas). Eles conversam por HTTP, com token. Reaproveitamos tudo que já construímos (orquestrador, prompts, base de conhecimento) — só adicionamos a camada multi-agente e os "tools" que falam com o CRM.

---

## 2. Os agentes do hub (registry)

Cada agente = **um system prompt** (a "skill" SMQ correspondente) + **as ferramentas** que ele pode usar + o modelo.

| agentId | Para o corretor faz... | Lê do CRM | Escreve no CRM |
|---|---|---|---|
| `qualificacao` | (já existe, no WhatsApp) | lead | atualiza lead, dispara roleta |
| `analise-credito` | pré-análise MCMV (faixa, parcela, subsídio) | lead (renda, FGTS, idade) | salva parecer no histórico |
| `conferente-doc` | checklist de documentação p/ Caixa | lead + projeto | salva checklist/pendências |
| `preparador-visita` | briefing pré-visita (perfil, objeções, roteiro) | lead + projeto + histórico | — |
| `curador-imoveis` | casa o lead com o estoque + roteiro | lead + estoque (projetos) | — |
| `gerador-documentos` | proposta/LOI/contrato a partir do negócio | lead + projeto | salva rascunho |
| `treinador-objecoes` | "como respondo isso?" / treino | — (consulta) | — |
| `cma-precificacao` | análise de mercado p/ captação | comparáveis | salva CMA |

> Começo recomendado: `analise-credito`, `conferente-doc`, `preparador-visita`, `curador-imoveis` (os de maior uso diário do corretor).

---

## 3. Contrato da API (Agent Hub)

### Acionar um agente
```
POST /agents/:agentId/run
Authorization: Bearer <HUB_TOKEN>
{
  "corretorId": 38400413,
  "leadId": 4329219,          // opcional (contexto)
  "projectId": 12,            // opcional
  "sessionId": "abc",         // mantém a conversa do corretor com o agente
  "input": "faz a pré-análise desse lead"
}
→ { "reply": "texto/markdown do agente", "acoes": [...], "sessionId": "abc" }
```

### Ferramentas que o Hub chama no CRM (read/write)
O CRM expõe (ou já tem) endpoints que o Hub consome:
- `GET /api/leads/:id` → perfil + campos de qualificação
- `GET /api/leads/:id/historico` → mensagens/eventos do lead
- `GET /api/projetos/:id` → dados do empreendimento
- `GET /api/estoque?regiao=&faixa=` → inventário p/ o curador
- `POST /api/leads/:id/nota` → salva parecer/checklist no histórico
- `POST /api/leads/:id/distribuir` → roleta (já discutido)

> Tudo autenticado com token de serviço. O Hub nunca acessa o banco direto — usa a API do CRM (fonte de verdade, com regras e RBAC).

---

## 4. O que cada lado constrói

### Lado CRM (Manus)
1. **UI**: painel/aba "Agentes IA" na tela do lead e do projeto — lista de agentes + chat. (O CRM já tem o módulo `chatbot` — dá pra reaproveitar a base de conversas.)
2. **Proxy autenticado**: `POST /api/agents/proxy` que (a) valida o corretor logado e suas permissões, (b) injeta `corretorId/leadId/projectId`, (c) chama o Hub, (d) devolve a resposta e (e, opcional) salva no histórico do lead.
3. **Read endpoints** que faltarem (lead, histórico, projeto, estoque) — vários já existem; mapear o que falta.

### Lado Agent Hub (nós)
1. **Registry de agentes** — portar cada skill SMQ para um system prompt + definir os tools de cada um.
2. **Endpoint unificado** `/agents/:id/run` + memória de sessão por (corretor, agente, lead).
3. **Tools CRM** — funções `getLead/getProjeto/getHistorico/buscarEstoque/salvarNota/distribuirRoleta` que chamam a API do CRM.
4. **RBAC/limites** — só corretor autenticado, rate limit, log de uso (pra medir adoção e custo por agente).

---

## 5. Integração com a roleta e a base
- **Roleta**: o agente de qualificação (e o handoff) já chamam o endpoint de distribuição do CRM. Os agentes de corretor (análise, doc, visita) operam **sobre o lead já atribuído** — leem o lead pelo `leadId` e gravam parecer/checklist no histórico dele.
- **Base completa**: como o Hub lê tudo via API do CRM (lead, projeto, histórico, estoque), os agentes têm o contexto real — sem duplicar dados. O CRM continua dono da informação.
- **Histórico**: cada interação corretor↔agente pode ser salva no histórico do lead (auditoria + alimenta o futuro "agente revisor" de conversão).

---

## 6. Segurança
- Token de serviço entre CRM↔Hub (nunca expor a chave da Anthropic no front).
- RBAC: o corretor só aciona agente em leads que são dele (ou conforme regra do gestor).
- Log de uso por corretor/agente (custo + auditoria).
- LGPD: dados sensíveis (CPF) só trafegam quando o agente precisa (ex.: análise), e ficam no CRM.

---

## 7. Roteiro sugerido (fases)
1. **Fase 1** — Hub com 1 agente "de corretor" (ex.: `analise-credito`) + 1 read endpoint (`getLead`) + painel simples no CRM. Prova de valor.
2. **Fase 2** — adiciona `conferente-doc`, `preparador-visita`, `curador-imoveis` + endpoints de projeto/estoque + salvar no histórico.
3. **Fase 3** — memória de sessão, log de uso, RBAC fino, e o "agente revisor" de conversão lendo os históricos.

---

## 8. Decisão que define o build
**Onde os agentes rodam?**
- **A) Agent Hub separado (recomendado)** — reaproveita nosso orquestrador e prompts; a Manus faz só UI + proxy + read endpoints. Menos acoplamento, evolui rápido.
- **B) Embutido no CRM** — a Manus implementa os agentes dentro do código do CRM (acesso direto ao banco). Mais "nativo", porém concentra tudo na Manus e duplica a lógica de agente.

> Recomendo **A**: mantém um só lugar pra evoluir os agentes (que já está pronto e testado), e o CRM ganha só a casca + os dados.
