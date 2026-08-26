# News briefing consumer contract

This local change is additive. It has not been deployed to the NAS.

- `GET /api/s/briefing/sources`: version 1, editorial source profiles and enabled state. X is excluded pending successful real-post retrieval.
- `GET /api/s`: original fields and refresh policy retained; optional `preview`, `publisher`, and `freshness` added. `freshness.fetchedAt` is the true cache timestamp, not a page read timestamp. States: `fresh`, `cached`, `empty`, `error`.
- `GET /api/s/briefing/preview?sourceId=...&itemId=...`: only articles in a registered source cache. No arbitrary URL fetches. Responses retain partial source content if enrichment fails.

Preview completion permits only configured HTTPS publisher hosts and public IPv4 DNS answers, pins the address used by the connection, revalidates redirects (maximum two), limits HTML to 1 MB, DNS to three seconds, and each HTTP request to eight seconds. Only two enrichment requests run concurrently. Returned previews are plain text; scripts and navigation are removed. Missing publication times stay null.

The existing Reuters source uses a Google News RSS search, often with headline-only content. The existing `zaobao` adapter reads zaochenbao.com; its briefing publisher is labeled as an aggregator, not an official Zaobao connection. Consumer coverage must distinguish source failures/empty responses from no new news.

Local verification (Node 24): full Vitest 51/51, affected ESLint, Vite build and `tsc --noEmit -p tsconfig.node.json` pass. Full `pnpm typecheck` reproduces three pre-existing generated `imports.app.d.ts` syntax errors (TS1389/TS1134/TS1389, illegal `const import`). The clean `424f18f` baseline reproduces exactly these three errors; no new errors were introduced.

Deployment requires separate approval. Release only this project's tested files against the actual NAS baseline, verify old `/api/s` clients first, and then enable the downstream manual briefing feature. Scheduled generation is separately gated downstream. No dependency upgrades or authentication-policy changes are included.
