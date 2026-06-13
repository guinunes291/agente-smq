# Matriz de Roteamento — Corretores Responsáveis

Define **para quem o agente faz o handoff** quando o lead é qualificado/aceita a análise. A regra do negócio é: **cliente direcionado ao corretor responsável pelo projeto**.

## Lógica de direcionamento (ordem de prioridade)

1. **Por empreendimento de interesse**: se o lead falou de um projeto específico (ex.: Vibra Sabará → EMP001 → COR001), encaminha ao responsável daquele projeto.
2. **Por região + perfil**: se não há projeto definido, usa `regioes` + `especialidade` (ex.: investidor em studio na Consolação → COR003).
3. **Round-robin / disponibilidade** (opcional): se vários corretores cobrem o mesmo projeto, distribua de forma equilibrada e respeitando `horario_atendimento` e `ativo=sim`.
4. **Fallback**: se nenhum corretor casar, encaminhe para um **plantonista/coordenador** definido (defina um `COR000` plantão).

## O que o handoff entrega ao corretor

Ao acionar `HANDOFF`, o corretor recebe (WhatsApp interno / e-mail / card no CRM):

```
🔔 LEAD QUALIFICADO — passar a conduzir
Nome: {{nome}}  |  Tel: {{telefone}}
Origem: {{origem}}
Objetivo: {{morar/investir}}  |  Faixa de renda: {{faixa}}
Região desejada: {{regiao}}  |  Interesse: {{empreendimento}}
Temperatura: {{QUENTE/PRONTO}}
Aceitou: [ ] análise de crédito  [ ] visita ({{data/hora}})
Resumo da conversa: {{resumo}}
Próximo passo: {{ex.: conduzir pré-análise / confirmar visita}}
```

> ⚠️ SLA: o corretor deve assumir o lead em **até X minutos** (defina; sugestão: 10 min em horário comercial). Se não assumir, o agente pode reforçar o aviso ou escalar ao coordenador — **mas o agente não volta a conduzir a venda** depois do handoff (apenas mantém o cliente aquecido com uma mensagem-ponte se houver demora).

## Preencher

Substitua `[PREENCHER nome]` e os telefones/e-mails reais. Ligue cada corretor aos `projetos_responsaveis` (ids do `empreendimentos.csv`).
