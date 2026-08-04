# Hosts gbrain's HTTP MCP server (search/get_page/etc over HTTPS) so the
# Vercel-deployed Next.js app and local dev can share one Supabase-backed
# brain. Ingestion stays local-only — see JOURNAL.md 2026-08-04.
FROM oven/bun:1

RUN bun install -g github:garrytan/gbrain

# No local_path source or config.json is baked in on purpose: engine and
# database_url are supplied entirely via env vars at runtime (Railway
# dashboard), so no secrets ever live in the image or this repo.
# gbrain defaults to engine=postgres automatically when no config.json
# exists and GBRAIN_DATABASE_URL is set.

EXPOSE 3131

# Shell form (not exec array) so $PORT expands — Railway assigns it dynamically.
# --public-url deliberately omitted: only needed for OAuth 2.1 issuer discovery,
# and this deployment uses legacy bearer tokens (gbrain auth create), not OAuth.
CMD gbrain serve --http --port ${PORT:-3131} --bind 0.0.0.0
