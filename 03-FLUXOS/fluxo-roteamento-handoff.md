# Fluxo — Roteamento & Handoff

## Quando dispara

- Cliente **aceita análise de crédito** (prioridade máxima).
- Cliente **confirma visita**.
- Cliente **pede humano** ou demonstra intenção de fechar.
- Situação delicada (reclamação, jurídico, cliente já em processo).

## Como o agente escolhe o corretor

```
SE empreendimento_de_interesse definido:
   corretor = corretor_responsavel(empreendimento)   # via empreendimentos.csv → corretores.csv
SENÃO SE regiao + perfil definidos:
   corretor = corretor por regiao/especialidade       # corretores.csv
SENÃO:
   corretor = plantonista/coordenador (COR000 fallback)
Respeitar: ativo=sim e horario_atendimento. Se vários, round-robin.
```

## Passagem de bastão (mensagem ao cliente)

> *"Perfeito, {{Nome}}! Já estou te conectando com o **{{corretor}}**, responsável pelo **{{empreendimento}}**. Ele cuida da sua {{análise/visita}} e te mostra as melhores unidades. Já recebeu seu contato e te chama em instantes. 🙌"*

## Notificação ao corretor (card de handoff)

```
🔔 LEAD QUALIFICADO
Nome: {{nome}} · Tel: {{telefone}} · Origem: {{origem}}
Objetivo: {{morar/investir}} · Renda: {{faixa}} · Região: {{regiao}}
Interesse: {{empreendimento}} · Temperatura: {{QUENTE/PRONTO}}
Aceitou: [ ] análise  [ ] visita {{data/hora}}
Resumo: {{resumo da conversa}}
Próximo passo: {{conduzir pré-análise / confirmar visita}}
Abrir conversa: {{deep link wa.me/55...}}
```

## Pós-handoff

- O agente **não retoma** a condução comercial.
- Se o corretor demorar além do SLA (sugestão 10 min em horário comercial), o agente pode enviar **uma** mensagem-ponte ("o {{corretor}} já já te chama, tá? 🙏") e escalar ao coordenador — sem reabrir a venda.
- Registrar no CRM: `estagio = handoff`, `corretor_destino`, timestamp.
