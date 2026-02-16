FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

FROM base AS production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=build /app/packages ./packages
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "node dist/worker.js & exec node dist/index.js"]
