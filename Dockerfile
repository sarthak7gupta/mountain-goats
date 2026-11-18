FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm@12.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV MODE=online PORT=3000 DATABASE_PATH=/data/rooms.sqlite
EXPOSE 3000
CMD ["pnpm", "start"]
