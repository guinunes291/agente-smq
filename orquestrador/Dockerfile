# Dockerfile do orquestrador. Contexto de build = raiz do projeto Agente-Qualificacao-SMQ
# (para incluir as pastas de conhecimento 01-CONTEXTO-AGENTE e 02-BASE-CONHECIMENTO).
FROM node:22-slim

WORKDIR /app

# instala dependencias primeiro (cache)
COPY orquestrador/package.json orquestrador/package-lock.json* ./orquestrador/
RUN cd orquestrador && npm install --omit=dev --no-fund --no-audit

# copia o codigo e a base de conhecimento
COPY orquestrador ./orquestrador
COPY 01-CONTEXTO-AGENTE ./01-CONTEXTO-AGENTE
COPY 02-BASE-CONHECIMENTO ./02-BASE-CONHECIMENTO

ENV NODE_ENV=production
WORKDIR /app/orquestrador
EXPOSE 3000
CMD ["node", "src/index.js"]
