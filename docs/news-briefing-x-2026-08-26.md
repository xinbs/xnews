# X discovery and public previews — 2026-08-26

The existing source API is unchanged; added fields are optional. Three briefing sources (`x-tech`, `x-world`, `x-security`) share a Following timeline and Latest/Top topic searches. Accounts only aid publisher attribution, never admission. The transport is standalone x-kit-api; credentials remain there.

- Off unless `X_NEWS_ENABLED=true`; disabled on Cloudflare Pages.
- At most seven requests per ten minutes, two concurrent, six-second HTTP timeouts, 512KB responses; shared cache including empty responses; 429 cooldown. No pagination, trend fanout or credentials in requests.
- Only explicitly public original posts, within 48 hours. Exclude replies, quote/reposts, restricted/sensitive posts and promotion. Missing public-state contract is an error. Limit each author; reserve capacity for each discovery channel before ordering by time.
- Keep original post text, true publication/fetch times, channels, safe media and expanded links. A post is an attributed statement, not independent corroboration.
- Optional previews use known source and cached article ID only. Related publisher hosts are explicitly configured. DNS/public-address, size, redirect, timeout and HTML checks remain enforced. Google News landing text is not an article; only a visible configured-publisher link can be followed. No login/paywall circumvention.
- Preserve public metadata and explicitly free structured article body. Cache negative previews for 24 hours without invalidation from an unrelated source refresh. Preview work is single-flight and two concurrent.

Validation: Vitest 70/70; server/shared ESLint clean; node TypeScript and production build pass. App TypeScript retains the same three pre-existing generated `imports.app.d.ts` syntax diagnostics (TS1389/TS1134/TS1389), with no additions. Real transport validation: seven calls, 10.901 seconds, 24 public candidates per category, all with bodies; tech also included Following discoveries. Tests use fixtures, not credentials.

Rollout: image overlay on the exact running xnews image, preserve its environment/mounts and old cache; only enable X and change image. Never rebuild or operate OOF, market proxy or research data. Roll back image and X switch together. Stock news scheduling remains off and news thinking remains disabled.
