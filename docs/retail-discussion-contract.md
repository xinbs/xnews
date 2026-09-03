# Public retail-discussion sampling v1

Approved scope: add bounded public Guba sampling and jointly deploy with stock_analysis. No purchased data, authentication bypass, new dependency or trading changes.

`GET /api/s/retail/sample?code=000001` accepts only validated six-digit A-share codes. No arbitrary URL, pagination or force-refresh input. Returns version, source, code, real fetched/checked timestamps, state, normalized posts and coverage. A post has an id, code, source URL, plain text (max 1,200 chars; truncation flagged), title, publication time, content hash and hashed author ID. Nickname, IP, age and other profile data are not retained. The hash is for deduplication, not expertise inference.

- Source: `https://guba.eastmoney.com/list,000001,f.html`, latest-published list; `https://guba.eastmoney.com/news,000001,POST_ID.html`, matching body. JSON assignments are parsed, never evaluated.
- Latest page only, rolling 24 hours, ordinary unpinned posts, max 10 bodies/stock, max 2 posts/author, body/text deduplication. `eligible` and `recent2h` describe valid ordinary list entries before body selection, not the full forum. `firstPageOnly` and `capped` are mandatory caveats.
- Cache one hour; failures keep prior posts and original fetchedAt and are negative-cached for five minutes. Two stock collections at once, single-flight identical codes, persisted global 160-request/hour ceiling reserved before network calls. Production runs one Node process.
- Reuses briefing-fetch HTTPS allowlist, public IPv4 validation and DNS pinning, redirect revalidation, 8-second timeout and 1 MB limit. No login, cookies, challenge solving or browser session transport.
- Existing news feeds and briefing sources are unchanged. Text classification and metrics belong to stock_analysis, not this source service.

2026-09-03 verification: public list/body retrieved with the actual safe-fetch implementation on Mac; NAS Node fetch returned HTTP 200 for the public list. Full Vitest 75/75 before the final formatting pass; build and server TypeScript passed. Final release evidence is recorded in stock_analysis/docs/goal-progress-2026-08-24.md.

Deploy as a build-output overlay on the exact existing `xnews-newsnow:discovery-c1c47c8` image. Retain its Linux runtime/dependencies, all environment variables and `newsnow_data` mount. Do not copy local macOS native node_modules into the image. Preserve the prior image and compose settings for rollback.
