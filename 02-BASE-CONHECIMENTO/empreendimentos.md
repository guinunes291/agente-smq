# Empreendimentos — base de produtos do agente

O agente consulta `empreendimentos.csv` para fazer o **match produto ↔ perfil do cliente**. Mantenha esse CSV atualizado: é a fonte de verdade. **Preencha com seus dados reais** — os exemplos abaixo foram puxados do que apareceu nos atendimentos (Vibra Sabará, Nova Leopoldina) e marcados com `[EXEMPLO]`/`[PREENCHER]`.

## Campos (colunas do CSV)

| Campo | O que é | Exemplo |
|-------|---------|---------|
| `id` | código único | EMP001 |
| `nome` | nome do empreendimento | Vibra Sabará |
| `construtora` | incorporadora | Vibra |
| `regiao` / `bairro` / `cidade` | localização | Zona Sul / Cidade Vargas / São Paulo |
| `tipo_produto` | MCMV / Médio padrão / Alto padrão / Investimento | MCMV |
| `perfil_cliente` | para quem serve | Primeiro imóvel / moradia |
| `dormitorios` / `metragem_m2` / `vagas` / `tem_varanda` | atributos físicos | 2 / 37 / 1 / sim |
| `faixa_mcmv` | enquadramento | F2/F3 |
| `preco_de` / `preco_por` / `parcela_a_partir` | valores | 290000 / 274900 / — |
| `status` / `previsao_entrega` | fase | lançamento / dez/2028 |
| `corretor_responsavel_id` | liga à matriz de corretores | COR001 |
| `link_planta` | URL da planta/material | — |
| `observacoes` | notas livres | anúncio Instagram Zona Sul |

## Como o agente usa

1. Identifica **objetivo** (morar/investir), **região** e **faixa de renda** do lead.
2. Chama `BUSCAR_EMPREENDIMENTO` filtrando por esses campos.
3. Apresenta 1–2 opções que encaixam — **sem inventar** valores fora do CSV.
4. Puxa para análise/visita e, no aceite, faz handoff para o `corretor_responsavel_id`.

## Regra de cobertura de portfólio (não descartar)

Garanta que o CSV tenha pelo menos uma opção para cada perfil, para o agente nunca ficar sem resposta:
- **F1/F2 (renda baixa, 1º imóvel)** — MCMV com subsídio.
- **F3 (renda média)** — MCMV sem subsídio / entrada de médio padrão.
- **Médio/alto padrão** — para quem quer maior/melhor (ex.: Marajoara, 2-3 dorms >50m²).
- **Investidor** — studios/1 dorm em regiões de locação (Consolação, Vila Madalena, Pinheiros, Itaim).

> Dica: exporte sua tabela atual (a que você já usa com as construtoras) para esse formato. Posso te ajudar a converter os PDFs/planilhas de tabela em CSV.
