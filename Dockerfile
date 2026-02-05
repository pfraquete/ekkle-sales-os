# ===========================================
# EKKLE SALES OS - Dockerfile (API)
# Multi-stage build otimizado com Bun
# ===========================================

# Stage 1: Dependencies
FROM oven/bun:1.1-alpine AS deps

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json bun.lockb* ./

# Instalar dependências (production only)
RUN bun install --frozen-lockfile --production

# ===========================================
# Stage 2: Builder
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Type check (opcional)
# RUN bun tsc --noEmit

# ===========================================
# Stage 3: Production Runtime
FROM oven/bun:1.1-alpine AS runner

WORKDIR /app

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ekkle

# Copiar apenas o necessário para produção
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

# Definir variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Expor porta
EXPOSE 3000

# Mudar para usuário não-root
USER ekkle

# Health check usando wget (disponível no alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando de inicialização
CMD ["bun", "run", "src/api/server.ts"]
