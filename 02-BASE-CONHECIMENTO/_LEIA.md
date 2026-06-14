# 02-BASE-CONHECIMENTO — Dados OPERACIONAIS (ao vivo)

> ⚠️ **Esta pasta é lida pelo código em tempo real.** O orquestrador (`orquestrador/src/knowledge.js`) carrega arquivos **por nome, deste caminho fixo**. Não renomeie a pasta nem os arquivos abaixo sem ajustar o código.

## O que o agente carrega daqui (a cada execução)
- `empreendimentos.csv` → inventário de produtos
- `corretores.csv` → matriz de roteamento (pra quem mandar o lead)
- `regras-mcmv-2026.md` → faixas, regra dos 30%, FGTS, tipos de renda
- `faq.md` → respostas prontas

## Como atualizar
Edite **o conteúdo** desses arquivos (ex: novo empreendimento, novo corretor, faixa atualizada). Mantenha **os nomes** iguais. O agente passa a usar na próxima execução, sem mexer em código.

> Para mudar o caminho, use a variável de ambiente `KB_DIR` (ver `knowledge.js`).

---
**Camada irmã:** conhecimento de fundamento/treinamento (mais profundo, não lido pelo código) fica em `../06-FUNDAMENTOS/`.
