# Arquitetura & Estratégia Anti-Bloqueio

## 1. Por que NÃO automatizar o WhatsApp Web

Automatizar o WhatsApp Web/app (clicar, digitar, disparar em massa) viola os Termos de Uso do WhatsApp e é o **principal motivo de banimento de número**. Funciona para 10–20 mensagens manuais, mas em escala o número é derrubado — geralmente sem aviso e sem recuperação. Para um agente que fala com dezenas/centenas de leads por dia, esse caminho é inviável.

## 2. Arquitetura recomendada (dois canais)

Você tem **API Oficial da Meta** e **Z-API**. Use os dois com papéis diferentes:

| Camada | Canal | Papel | Risco de bloqueio |
|--------|-------|-------|-------------------|
| **Outbound frio / primeiro contato** | **Meta Cloud API** | Disparar o 1º contato via **template aprovado (HSM)** com opt-in | Baixíssimo (oficial) |
| **Janela conversacional (24h)** | Meta Cloud API **ou** Z-API | Responder o lead enquanto a conversa está "quente" | Baixo |
| **Fallback / número secundário** | Z-API | Conversas já iniciadas pelo cliente, testes, volume menor | Médio (não-oficial) |

> **Regra prática:** todo *primeiro toque* num lead que ainda não falou com você sai pela **API oficial com template aprovado**. Conversa que o **cliente iniciou** (ex.: veio do anúncio "Enviar mensagem") pode ser respondida por qualquer um dos dois dentro da janela de 24h.

### Diagrama lógico

```
        LEAD (anúncio Meta / formulário / base)
                     │
                     ▼
   ┌─────────────────────────────────────────┐
   │  ORQUESTRADOR (n8n / Make / Typebot /    │
   │  código com Agent SDK)                   │
   │  - carrega system-prompt.md              │
   │  - consulta BASE-CONHECIMENTO            │
   │  - aplica FLUXOS                         │
   └───────────────┬─────────────────────────┘
                   │
        ┌──────────┴───────────┐
        ▼                      ▼
  META CLOUD API           Z-API
  (1º contato HSM,        (janela 24h,
   janela 24h)            fallback)
        │                      │
        └──────────┬───────────┘
                   ▼
              WhatsApp do LEAD
                   │
         (lead aceita análise de crédito)
                   ▼
   ┌─────────────────────────────────────────┐
   │  HANDOFF → CORRETOR RESPONSÁVEL          │
   │  (notifica corretor + registra no CRM)   │
   └─────────────────────────────────────────┘
```

## 3. As 10 travas anti-spam (obrigatórias)

1. **Opt-in real**: só dispara para quem pediu contato (preencheu formulário, clicou no anúncio, autorizou). Guardar evidência (data, origem, texto do opt-in).
2. **Primeiro contato sempre por template aprovado (HSM)** na API oficial — nunca texto livre frio.
3. **Janela de 24h**: fora da janela, só template. Dentro da janela, texto livre liberado.
4. **Opt-out fácil e respeitado**: toda mensagem de iniciativa do agente oferece "responda SAIR para não receber mais". Ao receber SAIR/PARAR/STOP → marca opt-out e **nunca** mais dispara.
5. **Ritmo humano**: nada de rajadas. Limite de envio escalonado (ver "warmup" abaixo) e atraso aleatório de 3–15s entre mensagens.
6. **Cadência sem perseguição**: máximo de toques por lead/semana definido em `05-OPERACAO/cadencia-follow-up.md`. Sem reenvio em looping.
7. **Conteúdo variado**: não disparar a mesma frase idêntica para centenas de números (a Meta penaliza). Usar variações (o agente já gera naturalmente).
8. **Qualidade do número (Quality Rating)**: monitorar no painel da Meta. Se cair para "Médio/Baixo", reduzir volume imediatamente.
9. **Não enviar mídia/links pesados no 1º toque** — primeiro cria conexão, depois envia material.
10. **Horário comercial**: disparos entre 9h e 20h, dias úteis e sábado até 14h. Nada de madrugada.

## 4. Warmup do número (primeiras 2–3 semanas)

Número novo na API oficial começa com limite baixo e sobe conforme qualidade:

| Fase | Período | Volume/dia sugerido | Foco |
|------|---------|--------------------|------|
| Aquecimento 1 | Dias 1–3 | até 50 conversas | só leads quentíssimos (acabaram de pedir contato) |
| Aquecimento 2 | Dias 4–10 | até 250 conversas | leads do dia + respostas |
| Operação | Dia 11+ | conforme tier Meta (1k/10k/ilimitado) | base + novos |

> Os **tiers da Meta** (250 → 1.000 → 10.000 → ilimitado clientes únicos/24h) sobem automaticamente com bom Quality Rating. Não force volume com qualidade ruim.

## 5. Stack sugerida para o orquestrador

Você não precisa programar do zero. Opções, da mais simples à mais robusta:

- **Typebot + n8n** (low-code): Typebot monta o fluxo visual, n8n integra Meta/Z-API, banco e CRM. Bom custo-benefício.
- **Make (Integromat)**: conecta Meta Cloud API + Google Sheets/CRM + LLM (OpenAI/Anthropic) sem código.
- **Código próprio (Node/Python) com a Anthropic Agent SDK**: máximo controle; o `system-prompt.md` vira o prompt do agente e a BASE-CONHECIMENTO vira ferramentas/arquivos de contexto.

Em qualquer opção, o **cérebro** é o mesmo: `01-CONTEXTO-AGENTE/system-prompt.md` + os `03-FLUXOS`.

## 6. Dados que o agente precisa ler/gravar

- **Ler**: `empreendimentos.csv`, `corretores.csv`, `regras-mcmv-2026.md`, `faq.md`.
- **Gravar (CRM/planilha)**: nome, telefone, origem, faixa de renda, objetivo (morar/investir), região, temperatura, status (qualificando/agendado/análise/handoff), corretor destino, timestamp, opt-in/opt-out.
