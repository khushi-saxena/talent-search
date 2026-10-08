// Writes .env.local from the running local Supabase stack.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const out = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const s = JSON.parse(out.slice(out.indexOf("{")));

const pick = (...keys) => keys.map((k) => s[k]).find(Boolean);
const vars = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
  SUPABASE_DB_URL: pick("DB_URL"),
};
for (const [k, v] of Object.entries(vars)) {
  if (!v) throw new Error(`supabase status did not return a value for ${k}`);
}

// keep anything the user added by hand (e.g. their model key)
const keep = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.trim() && !Object.keys(vars).some((k) => l.startsWith(`${k}=`)))
  : [];
if (!keep.some((l) => l.startsWith("STRIPE_WEBHOOK_SECRET="))) {
  keep.push("STRIPE_WEBHOOK_SECRET=whsec_rotto_assessment_sample");
}

const lines = [...Object.entries(vars).map(([k, v]) => `${k}=${v}`), ...keep];
writeFileSync(".env.local", lines.join("\n") + "\n");
console.log("wrote .env.local");
