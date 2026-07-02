# syntax=docker/dockerfile:1

# ---------- Builder ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Build tools for native modules (better-sqlite3) if no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the app, then bake the SQLite cache from the vendored openfootball JSON.
RUN npm run build \
  && npm run db:ingest

# ---------- Runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone server + the assets it does not bundle.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The baked, read-only database.
COPY --from=builder /app/db/worldcup.sqlite ./db/worldcup.sqlite

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
