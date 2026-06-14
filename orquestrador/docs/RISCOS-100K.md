# Riscos e Melhorias @ 100.000 leads/mês

Resposta direta às duas perguntas obrigatórias da auditoria.

## "Se o sistema atendesse 100.000 leads/mês, quais os 20 maiores riscos operacionais?"

1. **Estado em arquivo único** — corrupção/lost-update sob concorrência; some no redeploy. *(mitigado: Repository/TiDB)*
2. **Processamento inline no webhook** — crash perde mensagens; sem garantia de entrega. *(fila — fase Estável)*
3. **Single-instance** — rotation/estado local impedem réplicas; teto de throughput.
4. **Sem fila/DLQ** — picos de inbound estouram o processo; nada para reprocessar.
5. **Custo de token do LLM** — 1 chamada/turno × N turnos × 100k; sem caching explode o gasto. *(mitigado: prompt caching)*
6. **Quality Rating da Meta** — volume alto + variação baixa de conteúdo derruba o número WhatsApp.
7. **Bloqueio anti-spam da Meta** — reentrega/duplicidade sem idempotência aumenta denúncias. *(mitigado: idempotência)*
8. **Opt-out falso-positivo** — perda comercial em massa por match ingênuo. *(corrigido)*
9. **Promessa de aprovação vazando** — risco jurídico (CDC/Bacen) multiplicado pelo volume. *(reforçado)*
10. **LGPD/PII** — dados pessoais sem retenção/erasure/cripto; incidente vira multa. *(mitigado: pseudonimização + forget)*
11. **Sem retry/circuit-breaker** — falha de Anthropic/Meta/CRM deixa lead sem resposta.
12. **Pool de conexões do TiDB** — esgota sob carga; queries de outcome em hot path.
13. **Hot-partition por telefone** — lead "barulhento" serializa e cria backlog.
14. **Perda de desfecho** — sem rótulo, o aprendizado degrada e decisões viram opinião. *(mitigado: /outcome)*
15. **Drift do catálogo** — empreendimentos/preços desatualizados → alucinação de valor.
16. **Alucinação de valor/condições** — modelo cita número fora do catálogo. *(mitigado: produto + compliance)*
17. **Latência do LLM em pico** — fila de turnos cresce; resposta lenta esfria o lead.
18. **Ausência de observabilidade/alerta** — falha silenciosa só aparece na queda de conversão. *(mitigado: telemetria/KPIs)*
19. **Round-trips ao CRM no hot path** — lookup/outcome síncronos adicionam latência e acoplam disponibilidade.
20. **Concorrência de jobs/cadência** — follow-ups em lote competindo com inbound; sem isolamento de workloads.

## "Quais as 20 melhorias de maior impacto que ainda poderiam ser feitas?"

1. Backbone durável (TiDB) como fonte de verdade do estado. *(iniciado)*
2. Ligação conversa→desfecho para aprendizado supervisionado. *(iniciado)*
3. Prompt caching no prefixo estável. *(feito)*
4. Agente de Qualidade (score 0–100) sobre toda conversa. *(scaffold)*
5. Cientista de Vendas minerando padrões de sucesso/fracasso. *(scaffold)*
6. Fila + retries + DLQ para entrega garantida e escala horizontal.
7. Dashboard de KPI por agente (tempo real).
8. A/B de scripts com gate humano (human-in-loop). *(experiments)*
9. Memória comportamental (responde rápido? some? horários).
10. Score preditivo de conversão por perfil/empreendimento.
11. Roteamento por aderência (lead↔corretor↔empreendimento).
12. Follow-up por comportamento real (no-show vindo do CRM).
13. Compliance com verificação LLM (além do determinístico).
14. Erasure LGPD self-service + ledger de consentimento. *(forget feito)*
15. Pseudonimização de PII em toda telemetria. *(feito)*
16. Idempotência de ponta a ponta. *(feito)*
17. Mutex/serialização por lead. *(feito)*
18. Multi-instância (estado/rotation no DB/Redis).
19. Gestão de Quality Rating Meta (warmup, variação de conteúdo, cadência).
20. Playbooks de treinamento gerados automaticamente. *(scaffold: training.js)*
