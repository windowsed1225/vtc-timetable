# Build with Bun from the repository root (single bun.lock, workspace layout).
# Runtime reinstalls from the lockfile in this image (avoid copying Bun's
# host-linked node_modules) and starts with `vinext start`.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY vtc-api/package.json ./vtc-api/
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
RUN groupadd --system vtc && useradd --system --gid vtc --home-dir /app --no-create-home vtc

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/vtc-api/package.json ./vtc-api/
RUN bun install --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
RUN chown -R vtc:vtc /app

USER vtc
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["bun", "run", "start"]
