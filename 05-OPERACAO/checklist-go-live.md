# Checklist de Go-Live

## Fase 0 — Pré-requisitos
- [ ] Conta Meta Business verificada (Business Verification)
- [ ] Número **dedicado** ao agente (não o pessoal)
- [ ] Z-API com instância conectada (número secundário) — opcional
- [ ] Orquestrador escolhido (n8n / Make / Typebot / código + Agent SDK)
- [ ] CRM ou planilha de leads definido (campos do logging)

## Fase 1 — Conteúdo (este pacote)
- [ ] `empreendimentos.csv` preenchido com produtos reais (todas as faixas/perfis cobertos)
- [ ] `corretores.csv` preenchido (nomes, telefones, projetos, fallback/plantão)
- [ ] `system-prompt.md` revisado e colado no orquestrador
- [ ] Templates de `04-MENSAGENS` submetidos e **aprovados** na Meta
- [ ] FAQ revisado com a realidade da operação

## Fase 2 — Integração
- [ ] Webhook da Meta recebendo mensagens
- [ ] Webhook da Z-API recebendo mensagens (se usar)
- [ ] Token permanente (System User) configurado
- [ ] Ações conectadas: BUSCAR_EMPREENDIMENTO, BUSCAR_CORRETOR, SALVAR_LEAD, AGENDAR, HANDOFF, OPT_OUT
- [ ] Handoff notificando o corretor de verdade (testar com você mesmo)

## Fase 3 — Travas anti-bloqueio
- [ ] Opt-in registrado para toda a base
- [ ] Opt-out funcionando (SAIR/PARAR) e respeitado
- [ ] Janela 9h–20h aplicada
- [ ] Atraso humano entre mensagens
- [ ] Variação de conteúdo ativa
- [ ] Plano de **warmup** (volume escalonado) definido

## Fase 4 — Teste piloto (antes de escalar)
- [ ] Testar com 5–10 leads reais (ou números seus)
- [ ] Validar: qualificação → análise → **handoff imediato** funcionando
- [ ] Validar: agendamento → confirmação D-2/D-1/D+0
- [ ] Validar: agente NÃO insiste após 2 convites
- [ ] Validar: agente NÃO promete aprovação e NÃO inventa valores
- [ ] Conferir Quality Rating após o piloto

## Fase 5 — Escala
- [ ] Subir volume gradualmente conforme tier/Quality Rating
- [ ] Acompanhar KPIs semanais
- [ ] Revisão quinzenal de mensagens e taxa de handoff
