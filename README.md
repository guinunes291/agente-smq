# Agente de Qualificação SMQ — Seu Metro Quadrado

Pacote completo de contexto, conhecimento, fluxos e materiais para colocar no ar um **agente de WhatsApp** que qualifica leads, agenda visitas, inicia a pré-análise de crédito e **direciona o cliente qualificado ao corretor responsável pelo projeto — sem intervenção humana**, e **sem risco de bloqueio por spam**.

> ⚠️ Princípio nº 1 (anti-bloqueio): o agente **não** opera automatizando o WhatsApp Web. Ele roda sobre a **API oficial (Meta WhatsApp Cloud API)** para tudo que é sensível a bloqueio, e usa a **Z-API** apenas na janela conversacional, com as travas descritas em `00-ARQUITETURA`.

---

## Como este pacote está organizado

```
Agente-Qualificacao-SMQ/
├── README.md                         ← você está aqui
├── 00-ARQUITETURA/
│   ├── arquitetura-e-anti-bloqueio.md  ← visão geral, regras anti-spam, warmup
│   ├── integracao-meta-cloud-api.md    ← passo a passo da API oficial
│   └── integracao-zapi.md              ← passo a passo Z-API + quando usar
├── 01-CONTEXTO-AGENTE/
│   ├── system-prompt.md               ← o "cérebro" do agente (cole no LLM)
│   └── guardrails-e-escalonamento.md  ← o que pode/não pode, LGPD, opt-out
├── 02-BASE-CONHECIMENTO/
│   ├── regras-mcmv-2026.md            ← faixas, 30%, FGTS, tipos de renda
│   ├── empreendimentos.csv            ← inventário (plugue seus dados reais)
│   ├── empreendimentos.md            ← mesmo conteúdo legível + instruções
│   ├── corretores.csv                ← matriz de roteamento
│   ├── corretores.md                 ← regras de direcionamento
│   └── faq.md                        ← respostas prontas a dúvidas comuns
├── 03-FLUXOS/
│   ├── fluxo-qualificacao.md          ← 7 dimensões + SPIN + temperatura
│   ├── fluxo-agendamento.md           ← D-2/D-1/D+0
│   ├── fluxo-analise-credito.md       ← coleta + pré-análise + gatilho de handoff
│   └── fluxo-roteamento-handoff.md    ← regra de subir pro corretor
├── 04-MENSAGENS/
│   ├── templates-mensagens.md         ← opt-in, HSM, qualificação, follow-up
│   └── tom-de-voz.md
└── 05-OPERACAO/
    ├── kpis-e-metricas.md
    ├── cadencia-follow-up.md          ← cadência anti-spam por temperatura
    └── checklist-go-live.md
```

---

## O que você precisa fazer (resumo)

1. **Preencher os dados reais** em `02-BASE-CONHECIMENTO/empreendimentos.csv` e `corretores.csv` (deixei o schema e exemplos).
2. **Escolher o canal**: subir a API oficial (recomendado) seguindo `integracao-meta-cloud-api.md`, e/ou conectar a Z-API que você já tem (`integracao-zapi.md`).
3. **Colar o `system-prompt.md`** no orquestrador do agente (n8n, Make, Typebot, ou código próprio com a Agent SDK).
4. **Submeter os templates** de `04-MENSAGENS` para aprovação na Meta (os de primeiro contato/HSM).
5. **Rodar o checklist** de `05-OPERACAO/checklist-go-live.md` antes de ligar para a base.

---

## Regra de ouro do negócio (definida por você)

> O agente é **enfático, nunca insistente**, e tem dois objetivos de conversão: **agendamento presencial** e **análise de crédito**. **No instante em que o cliente aceita fazer a análise de crédito, o lead sobe imediatamente para o corretor responsável pelo projeto** — o agente para de conduzir e faz a passagem de bastão.

---

## Aviso de responsabilidade

A pré-análise de crédito feita pelo agente é **comercial e estimativa**. A aprovação formal é da **Caixa Econômica Federal**. O agente **nunca promete aprovação**. Todo material aqui segue essa regra.
