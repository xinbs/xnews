# Public retail-discussion sampling v1

## Additional independent Taoguba source

`GET /api/s/retail/tgb` has no query parameters. Response: version1, source:tgb-public, state, fetchedAt, checkedAt, posts, coverage. Each 6–1200-character excerpt has namespaced id, parentId, post/reply kind, title, text hash, one-way author hash, canonical public URL, actual publication time, observation time, truncation flag. No profile fields. Replies use their own timestamps, never parent or latest-reply time. Only current Shanghai day plus six preceding days; never future posts.

Discovery reads at most24 ordinary public list pages, finds actual dates, and chooses at most8 threads/day, unchecked then active first. Only the first two threads/day may read one extra public next page.120 requests/hour persisted before network,1.2-second spacing, single-flight, one-hour cache including failures,7-day retention/max4200 excerpts, latest200/day returned/max1400. Always bounded:true and complete:false; active-thread bias and missing dates remain visible.

Reuses truthful xnews-briefing User-Agent and safe HTTPS reader (allowlist, public DNS pinning,8s,1MB). No cookies, login, bypass, hidden paid content, arbitrary URL/page/date, new dependency. A failed page stops the run, preserving previous and already-read excerpts with original clocks. Only successfully read new bodies advance fetchedAt, including partial runs. No full-body UI mirror: the consumer shows aggregate counts and short attributed evidence.

Eastmoney endpoint/cache stay unchanged; stock_analysis owns source-aware aggregation and cross-source deduplication. Snowball hot-stock feed is not a post source. Deployment uses the exact existing retail-ee4503e image as a build-output overlay, retaining Linux node_modules, configuration and data mount.

## Existing Eastmoney contract

Approved scope: add bounded public Guba sampling and jointly deploy with stock_analysis. No purchased data, authentication bypass, new dependency or trading changes.

`GET /api/s/retail/sample?code=000001` accepts only validated six-digit A-share codes. No arbitrary URL, pagination or force-refresh input. Returns version, source, code, real fetched/checked timestamps, state, normalized posts and coverage. A post has an id, code, source URL, plain text (max 1,200 chars; truncation flagged), title, publication time, content hash and hashed author ID. Nickname, IP, age and other profile data are not retained. The hash is for deduplication, not expertise inference.

- Source: `https://guba.eastmoney.com/list,000001,f.html`, latest-published list; `https://guba.eastmoney.com/news,000001,POST_ID.html`, matching body. JSON assignments are parsed, never evaluated.
- Latest page only, rolling 24 hours, ordinary unpinned posts, max 10 bodies/stock, max 2 posts/author, body/text deduplication. `eligible` and `recent2h` describe valid ordinary list entries before body selection, not the full forum. `firstPageOnly` and `capped` are mandatory caveats.
- Cache one hour; failures keep prior posts and original fetchedAt and are negative-cached for five minutes. Two stock collections at once, single-flight identical codes, persisted global 160-request/hour ceiling reserved before network calls. Production runs one Node process.
- Reuses briefing-fetch HTTPS allowlist, public IPv4 validation and DNS pinning, redirect revalidation, 8-second timeout and 1 MB limit. No login, cookies, challenge solving or browser session transport.
- Existing news feeds and briefing sources are unchanged. Text classification and metrics belong to stock_analysis, not this source service.

2026-09-03 verification: public list/body retrieved with the actual safe-fetch implementation on Mac; NAS Node fetch returned HTTP 200 for the public list. Full Vitest 75/75 before the final formatting pass; build and server TypeScript passed. Final release evidence is recorded in stock_analysis/docs/goal-progress-2026-08-24.md.

Deploy as a build-output overlay on the exact existing `xnews-newsnow:discovery-c1c47c8` image. Retain its Linux runtime/dependencies, all environment variables and `newsnow_data` mount. Do not copy local macOS native node_modules into the image. Preserve the prior image and compose settings for rollback.
