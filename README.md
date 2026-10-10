# Rotto recruiter search

```
make setup   # npm ci, local Supabase, migrations, 5,000 candidates, two recruiter logins
make dev     # builds and serves http://localhost:3000
make check   # end-to-end checks: isolation, free plan races, paging, billing, hostile input
make eval    # scores search against data/queries.json (FILE=data/extra-queries.json or data/hard-queries.json for harder briefs)
```
Needs Node 24, Docker and `GEMINI_API_KEY` (in your environment or `.env.local`). `STRIPE_WEBHOOK_SECRET` defaults to the sample secret in `.env.local`; your environment overrides it.

## How search works
1. `POST /api/search` sends the brief to Gemini with a forced JSON response schema. Every list in the schema is an enum built from the data (`scripts/vocab.mjs`), so the model can only pick roles, skills, cities, schools and so on that exist.
2. `normalizeFilters` checks the output again. Any value that isn't in the data becomes **unsupported** rather than being dropped, so a filter can never quietly widen.
3. `create_search` (Postgres) charges the plan, runs `match_candidates`, and stores the ordered result ids on the search row in one transaction. Paging is then a slice of that array: one indexed read, stable order, each person exactly once, and it never touches the quota.
4. Ranking: everyone returned matches every hard filter, so order only breaks ties: nice-to-have skills, then open to work, then years of experience.

## Keeping the model honest
- The data can't answer everything (languages, remote, a city we don't have). The model has to list those parts under `unsupported`, and then **we return nobody** and show the recruiter which part we couldn't search on, with a one-click remove. A brief that's only praise ("great engineers") gets the same treatment.
- Negations the data can answer are real filters, not unsupported: "never worked at a startup", "doesn't know Java", "never at Globalcorp". An excluded value that isn't in the data is a no-op, so it can't empty the results.
- The prompt is literal: no added filters, seniority words map to seniority (not years), and "React engineers" is a skill, not a role. In the example set, treating it as a role misses 15 of the 21 right people.
- Hostile briefs: the brief is wrapped as data, the output is forced to the schema and re-validated, and filters only ever reach SQL as bind values in a static query. Requests to "return everyone" end up in `unsupported`, so they return nothing.

## Tenancy, security, billing
- API routes use the recruiter's own token against Supabase, so **RLS is the enforcement**, not route code. `company_id` is set by a trigger from the token, and plan, usage, billing and search rows are read-only for recruiters. All functions are revoked from `public` and granted one by one. The secret key is used only by the webhook and is never `NEXT_PUBLIC_`.
- Free plan: `update companies set searches_used = searches_used + 1 where plan='paid' or searches_used < 1`. The row lock serialises concurrent requests, so 12 parallel searches give exactly one 200 (`make check`).
- Stripe: the signature is verified on the raw body with the official library. Events are deduped by `event.id`, then the subscription row only moves forward on `event.created` (a cancellation wins a tie). Plan = any `active` subscription. I don't reject old signature timestamps, because dedupe plus ordering already makes replays harmless and the sample events are older than Stripe's 5-minute default.

## Model
`gemini-3.5-flash-lite`, structured JSON output, temperature 0, minimal thinking. Turning a brief into filters is classification over a small, fixed vocabulary, so the fastest tier is enough, and it keeps a search well under the 3-second budget. Measured on the example briefs: ~770 input and ~150 output tokens, about **$0.0006 per search** at $0.30 / $2.50 per million, and ~1.2s typical latency. A few calls stall past 4s, so if the model hasn't answered in 2s a second identical request goes out and the first answer wins. That costs one extra call on slow searches and caps the tail near 3s. Repeated briefs are served from an in-memory cache. Override with `GEMINI_MODEL`.

## Results
`make eval`: 10/10 example briefs exactly right (100% precision and recall). On 20 harder briefs I wrote (synonyms, states, years, vague, unanswerable, injection): 20/20 exactly right. Average model time ~1.4s, ~770 tokens in and ~150 out.

## Tradeoffs
- Hard filters only, so the result is either exactly right or empty. That's good for precision on structured data, but a near-miss (9 years when asked for 10+) is never shown.
- Results are snapshotted per search. Paging is fast and stable, but a search doesn't see candidates added later.
- A free company's search is charged even when the brief turns out unsupported and returns nobody. The alternative lets people probe for free.
- Editing a filter is a new search (no model call, but it counts on the free plan), because the results change.

## With another week
- An eval set of a few hundred briefs, with the prompt tuned against it in CI.
- "Did you mean" suggestions for unsupported parts ("Portland" → nearest city we have).
- OR groups across kinds ("Go or Rust") in the filter schema.
- Usage metering and a real checkout link, plus rate limits per recruiter.
