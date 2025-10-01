# KCS Automation - Worker Service Dockerfile
# Optimized for Railway/Render deployment

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install system dependencies for sharp and canvas
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/llm/package.json ./packages/llm/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install dependencies
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY packages ./packages
COPY apps/api ./apps/api
COPY turbo.json ./
COPY tsconfig.json ./

# Generate Prisma Client
RUN pnpm --filter @kcs/db exec prisma generate

# Build packages and app
RUN pnpm build

# Production image
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules from prod-deps
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages /app/packages
COPY --from=prod-deps /app/apps/api/node_modules /app/apps/api/node_modules

# Copy built application
COPY --from=build /app/packages/db/dist /app/packages/db/dist
COPY --from=build /app/packages/db/node_modules/.prisma /app/packages/db/node_modules/.prisma
COPY --from=build /app/packages/llm/dist /app/packages/llm/dist
COPY --from=build /app/packages/queue/dist /app/packages/queue/dist
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/packages/shared/assets /app/packages/shared/assets
COPY --from=build /app/packages/types/dist /app/packages/types/dist
COPY --from=build /app/apps/api/workers /app/apps/api/workers
COPY --from=build /app/apps/api/lib /app/apps/api/lib

# Copy package files for runtime
COPY package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/prisma ./packages/db/
COPY apps/api/package.json ./apps/api/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port (Railway/Render auto-detect)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start workers
CMD ["node", "apps/api/workers/start.js"]

