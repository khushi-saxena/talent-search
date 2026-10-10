# Rotto recruiter search

```
make setup   # deps, local Supabase, migrations, 5,000 candidates, two recruiter logins
make dev     # builds and serves http://localhost:3000
make check   # end-to-end: isolation, free-plan race, paging, billing, hostile input (needs make dev)
make eval    # search accuracy on data/queries.json (FILE=data/extra-queries.json or data/hard-queries.json)
```
Needs Node 24, Docker, `GEMINI_API_KEY`. `STRIPE_WEBHOOK_SECRET` defaults to the sample secret; your environment overrides it.

## How search works
1. The brief goes to Gemini with a forced JSON schema. Every list in it is an enum built from the data (`scripts/vocab.mjs`), so the model can only pick roles, skills, cities, schools etc. that exist.
2. `normalizeFilters` re-validates the output, and `guardRoles` drops any role the brief never named (the model likes to turn "React engineers" into Frontend Engineer, which loses the full-stack half).
3. `create_search` (Postgres) charges the plan, runs `match_candidates` and stores the ordered result ids, all in one transaction. Paging is a slice of that array: fast, stable, each person once, never charged.
4. Everyone returned matches every filter, so ranking only breaks ties: nice-to-have skills, open to work, years.

## Stopping invented filters
- Anything the data can't answer (a language, remote, a city we don't have, "great engineers") goes in `unsupported`, and then **we return nobody** and show the recruiter what we couldn't search on, with one click to remove it. Nothing beats the wrong people.
- Unknown values are never dropped silently (that would widen the search). Negations the data can answer ("never at a startup", "no Java") are real filters.
- Hostile briefs: the brief is data, output is schema-forced and re-checked, and filters only reach SQL as bind values in a static query.

## Security, free plan, billing
- API routes call Supabase **with the recruiter's own token**, so RLS is the guard, not route code. `company_id` comes from a trigger, plan/billing rows are read-only, and functions are revoked then granted one by one. The secret key is only used by the webhook.
- Free plan: one conditional `UPDATE … where plan='paid' or searches_used < 1`. The row lock means 12 parallel searches give exactly one 200.
- Stripe: signature checked on the raw body, events deduped by id, and a subscription only moves forward by `event.created`. Paid = any active subscription. Old signature timestamps aren't rejected, since dedupe plus ordering make replays harmless (the samples are days old).

## Model and cost
`gemini-3.5-flash-lite`, temperature 0, minimal thinking: it's classification over a small vocabulary, so the fastest tier is enough. About 1,180 tokens in and 175 out, **~$0.0008 per search**, ~1.4s. If a call stalls past 2s a second one is sent and the first answer wins. `make eval`: **48/48 briefs exact** (10 examples + 38 harder ones).

## Tradeoffs
- Hard filters only: results are exactly right or empty, and near-misses (9 years for "10+") never show.
- Results are snapshotted per search, so paging is stable but won't see new candidates.
- An unsupported brief still uses the free search; otherwise it could be probed for free.
- Editing a filter is a new search (no model call, but it counts).

## With another week
A few hundred eval briefs tuned in CI, "did you mean" for unsupported parts (Portland → nearest city), OR groups across kinds ("Go or Rust"), and per-recruiter rate limits.
