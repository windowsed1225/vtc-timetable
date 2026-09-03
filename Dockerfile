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
# Own the work dir up front. This is a single inode, unlike a recursive chown
# after `bun install`, which walks every file in node_modules and makes Docker
# store a second copy of each one in the chown layer.
RUN groupadd --system vtc \
    && useradd --system --gid vtc --home-dir /app --no-create-home vtc \
    && chown vtc:vtc /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Install as vtc so node_modules is created owned by vtc, not fixed up later.
USER vtc

COPY --from=build --chown=vtc:vtc /app/package.json /app/bun.lock ./
COPY --from=build --chown=vtc:vtc /app/vtc-api/package.json ./vtc-api/
RUN bun install --frozen-lockfile

COPY --from=build --chown=vtc:vtc /app/dist ./dist
COPY --from=build --chown=vtc:vtc /app/public ./public
EXPOSE 3000
# Follows $PORT. Hardcoding 3000 here fails the check whenever the platform
# assigns another port, and an unhealthy container never gets routed traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health/live`).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["bun", "run", "start"]
