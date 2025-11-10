FROM node:20-bullseye AS builder
WORKDIR /usr/src
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential ca-certificates git curl && rm -rf /var/lib/apt/lists/*
ENV PYTHON=/usr/bin/python3
COPY . .
RUN corepack enable
RUN pnpm install
RUN pnpm run build

FROM node:20-bullseye
WORKDIR /usr/app
COPY --from=builder /usr/src/dist/output ./output
ENV HOST=0.0.0.0 PORT=4444 NODE_ENV=production
EXPOSE $PORT
CMD ["node", "output/server/index.mjs"]
