# 06-FUNDAMENTOS — Conhecimento de FUNDAMENTO / Treinamento

> 📚 **Esta pasta é a base profunda de conhecimento** (a "escola" do agente). É material de referência e treinamento — **não é carregado pelo código em tempo real**. Serve para você, para o time e para calibrar/evoluir o system-prompt e os fluxos.

## O que tem aqui (10 documentos)
| Arquivo | Conteúdo |
|---|---|
| `01-contexto-imobiliaria.md` | Quem é a SMQ, posicionamento |
| `02-publico-alvo.md` | Perfil de quem compra o 1º imóvel |
| `03-produtos-empreendimentos.md` | Visão dos produtos (narrativo) |
| `04-processo-comercial.md` | O funil e as etapas |
| `05-objecoes-comuns.md` | Objeções e como tratá-las |
| `06-vocabulario-mcmv.md` | O que dizer / nunca dizer (linguagem) |
| `07-exemplos-boas-mensagens.md` | Modelos do que funciona |
| `08-exemplos-mas-mensagens.md` | O que evitar (e por quê) |
| `09-portaria-mcmv-333.md` | Base regulatória |
| `10-playbook-conversas-smq.md` | Playbook de conversas ponta a ponta |

## Diferença para a `02-BASE-CONHECIMENTO/` (importante)
- **`02-BASE-CONHECIMENTO/`** = dados que mudam e o **código lê ao vivo** (corretores, empreendimentos, faixas, FAQ).
- **`06-FUNDAMENTOS/`** (aqui) = o **porquê e o como** — doutrina, exemplos, linguagem, regulação. Você lê para treinar o time e refinar o agente.

> Pense assim: a `02` é o **banco de dados**; a `06` é o **curso de formação**. As duas convivem, não competem.

## Se um dia quiser que o agente leia parte disto ao vivo
É possível, mas exige ajuste no `orquestrador/src/knowledge.js` (apontar para o arquivo e incluí-lo no contexto). Hoje, de propósito, o agente roda enxuto e só carrega o essencial operacional.
