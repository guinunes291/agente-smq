# Spec p/ Manus — CRM deve salvar o RESUMO + dados de qualificação no lead

## Por quê
No handoff, o agente já envia (no POST pro webhook do CRM) **todos os dados de qualificação + um resumo da conversa**. O CRM precisa **armazenar isso no lead** e exibir pro corretor, pra ele assumir já sabendo de tudo (sem o cliente repetir nada).

## O que o agente passa a enviar (campos extras no payload do webhook)
Além de `nome, telefone, email, faixaRenda, finalidadeImovel, prefereContatoPor, projectId`, agora vão também:

| Campo | Significado |
|---|---|
| `resumo` | **Resumo da conversa de qualificação** (5–8 linhas, gerado pela IA) |
| `observacao` | alias de `resumo` (caso o CRM use esse nome) |
| `empreendimentoInteresse` | empreendimento que o lead demonstrou interesse |
| `regiao` | região desejada |
| `fgts` | se tem/quanto de FGTS (texto) |
| `decisor` | se decide sozinho ou com cônjuge |
| `temperatura` | FRIO / MORNO / QUENTE / PRONTO |
| `motivoHandoff` | `analise` / `visita` / `humano` |
| `aceitouAnalise` | true se aceitou a análise de crédito |
| `aceitouVisita` | true se topou agendar visita |

## O que a Manus precisa implementar
No handler do webhook (`processarLeadWebhook` / rota `/api/webhook/lead/:token`):
1. **Aceitar** esses campos no corpo (hoje vários são ignorados).
2. **Salvar no lead**:
   - `resumo`/`observacao` → criar uma **nota/observação no histórico do lead** (ou um campo `observacao` na tabela `leads`), visível pro corretor.
   - `fgts`, `decisor`, `temperatura`, `motivoHandoff`, `aceitouAnalise`, `aceitouVisita`, `empreendimentoInteresse`, `regiao` → gravar nos campos correspondentes do lead (ou concatenar na nota se não houver coluna).
3. (Opcional) marcar o lead como **"qualificado pela IA"** pra diferenciar no funil.

## Exemplo de corpo recebido
```json
{
  "nome": "Thiago Martins",
  "telefone": "11984323550",
  "email": "thiagomartins1980.tm@gmail.com",
  "faixaRenda": "De 2.800,00 a 4.700,00",
  "finalidadeImovel": "moradia",
  "empreendimentoInteresse": "Vibra Sabara",
  "regiao": "Zona Sul",
  "fgts": "uns 5 mil",
  "decisor": "decide com a esposa",
  "temperatura": "QUENTE",
  "motivoHandoff": "analise",
  "aceitouAnalise": true,
  "resumo": "Lead quer sair do aluguel, 1º imóvel. Renda ~R$3,5k (CLT), tem ~R$5k de FGTS. Interesse no Vibra Sabará (Zona Sul), 2 dorms. Decide com a esposa. Aceitou fazer a análise de crédito. Próximo passo: corretor conduzir a análise e confirmar visita.",
  "observacao": "(mesmo texto do resumo)"
}
```

## Resultado esperado
O corretor abre o lead no CRM e **já vê o resumo + os dados de qualificação preenchidos** — não precisa perguntar tudo de novo. (73% dos clientes abandonam quando têm que repetir informação.)
