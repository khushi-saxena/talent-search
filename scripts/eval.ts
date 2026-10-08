// Scores the brief -> filters -> Postgres pipeline against data/queries.json.
//   make eval            (needs ANTHROPIC_API_KEY)
//   make eval FILE=...   (any file in the same format)
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { hasConstraints } from "../src/lib/filters";
import { briefToFilters, MODEL } from "../src/lib/llm";

type Q = { brief: string; expected_ids: string[] };

const file = process.argv[2] ?? new URL("../data/queries.json", import.meta.url).pathname;
const queries: Q[] = JSON.parse(readFileSync(file, "utf8"));

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4);

async function main() {
  const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await db.connect();
  let sumP = 0;
  let sumR = 0;
  let sumTop = 0;
  let sumMs = 0;

  for (const q of queries) {
    const t0 = Date.now();
    const { filters } = await briefToFilters(q.brief);
    const ms = Date.now() - t0;
    sumMs += ms;

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
    `\n${MODEL}: precision ${pct(sumP / n)}, recall ${pct(sumR / n)}, first page ${pct(sumTop / n)}, avg model time ${Math.round(sumMs / n)}ms`,
  );
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
