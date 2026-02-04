# ===========================================
# EKKLE SALES OS - Dockerfile
# Multi-stage build para Bun runtime
# ===========================================

# Stage 1: Build
FROM oven/bun:1.1 AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json bun.lockb* ./

# Instalar dependências
RUN bun install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build (opcional, Bun pode executar TypeScript diretamente)
# RUN bun build src/index.ts --outdir ./dist --target bun

# Stage 2: Production
FROM oven/bun:1.1-slim AS production

WORKDIR /app

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ekkle

# Copiar dependências e código
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Definir usuário
USER ekkle

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando padrão (API)
CMD ["bun", "run", "src/api/server.ts"]
