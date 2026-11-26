# Build the frontend with the full toolchain.
FROM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime: production dependencies, server source and the built frontend only.
FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm@12.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && npm uninstall -g pnpm
COPY server ./server
COPY src ./src
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production MODE=online PORT=3000 DATABASE_PATH=/data/rooms.sqlite
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
# Run node directly as PID 1 so SIGTERM reaches the graceful shutdown handler.
CMD ["node", "--import", "tsx", "server/http.ts"]
