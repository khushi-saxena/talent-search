// Scores the brief -> filters -> Postgres pipeline against data/queries.json.
//   make eval            (needs GEMINI_API_KEY and make setup)
//   make eval FILE=...   (any file in the same format)
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { hasConstraints } from "../src/lib/filters";
import { briefToFilters, lastUsage, MODEL } from "../src/lib/llm";

type Q = { brief: string; expected_ids: string[] };

const file = process.argv[2] ?? new URL("../data/queries.json", import.meta.url).pathname;
const queries: Q[] = JSON.parse(readFileSync(file, "utf8"));

// the free tier allows 15 requests a minute; wait it out instead of failing
// (a stalled call that hits the timeout counts too)
async function withRateLimit<T>(fn: () => Promise<T>): Promise<[T, number]> {
  for (let i = 0; ; i++) {
    const t0 = Date.now();
    try {
      return [await fn(), Date.now() - t0];
    } catch (e) {
      const limited = (e as { status?: number }).status === 429 || (e as Error).name === "AbortError";
      if (!limited || i >= 3) throw e;
      console.log("    rate limited, waiting 45s");
      await new Promise((r) => setTimeout(r, 45_000));
    }
  }
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4);

async function main() {
  const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await db.connect();
  let sumP = 0;
  let sumR = 0;
  let sumTop = 0;
  let sumMs = 0;
  let tokIn = 0;
  let tokOut = 0;

  for (const q of queries) {
    const [{ filters }, ms] = await withRateLimit(() => briefToFilters(q.brief));
    sumMs += ms;
    tokIn += lastUsage.prompt ?? 0;
    tokOut += lastUsage.output ?? 0;

    let ids: string[] = [];
    if (!filters.unsupported.length && hasConstraints(filters)) {
      const { rows } = await db.query("select id from match_candidates($1::jsonb)", [filters]);
      ids = rows.map((r) => r.id);
    }

    const want = new Set(q.expected_ids);
    const hits = ids.filter((id) => want.has(id)).length;
    // empty vs empty is a perfect answer
    const precision = ids.length ? hits / ids.length : want.size ? 0 : 1;
    const recall = want.size ? hits / want.size : ids.length ? 0 : 1;
    const top = ids.slice(0, 20);
    const topP = top.length ? top.filter((id) => want.has(id)).length / top.length : want.size ? 0 : 1;
    sumP += precision;
    sumR += recall;
    sumTop += topP;

    const mark = precision === 1 && recall === 1 ? "✓" : "✗";
    console.log(`${mark} P${pct(precision)} R${pct(recall)} top20${pct(topP)} ${String(ms).padStart(5)}ms  ${q.brief}`);
    if (mark === "✗" || process.env.VERBOSE) {
      const shown = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)),
      );
      console.log(`    got ${ids.length}, want ${want.size}: ${JSON.stringify(shown)}`);
    }
  }

  const n = queries.length;
  console.log(
    `\n${MODEL}: precision ${pct(sumP / n)}, recall ${pct(sumR / n)}, first page ${pct(sumTop / n)}, avg model time ${Math.round(sumMs / n)}ms, avg tokens ${Math.round(tokIn / n)} in / ${Math.round(tokOut / n)} out`,
  );
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
