// Loads candidates.json and creates one recruiter login per company.
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const RECRUITERS = [
  { email: "recruiter@acme.test", company: "acme" },
  { email: "recruiter@globex.test", company: "globex" },
];
const PASSWORD = "rotto-assessment";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (run scripts/env.mjs first)`);
  return v;
}

async function loadCandidates(db: Client) {
  const raw = readFileSync(new URL("../data/candidates.json", import.meta.url), "utf8");
  // flattening happens in SQL so the filter columns match the source exactly
  await db.query(
    `insert into public.candidates (
       id, full_name, avatar_url, headline, current_title, current_company, current_company_logo_url,
       role, seniority, years_experience, city, state, country, open_to_work, skills,
       companies, company_types, current_company_type, schools, degrees, fields, experiences, education)
     select
       c->>'id', c->>'full_name', c->>'avatar_url', c->>'headline', c->>'current_title',
       c->>'current_company', c->>'current_company_logo_url', c->>'role', c->>'seniority',
       (c->>'years_experience')::int, c->'location'->>'city', c->'location'->>'state',
       c->'location'->>'country', coalesce((c->>'open_to_work')::boolean, false),
       array(select jsonb_array_elements_text(coalesce(c->'skills', '[]'))),
       array(select distinct e->>'company' from jsonb_array_elements(c->'experiences') e),
       array(select distinct e->>'company_type' from jsonb_array_elements(c->'experiences') e),
       (select e->>'company_type' from jsonb_array_elements(c->'experiences') e
         where e->>'end_year' is null limit 1),
       array(select distinct e->>'school' from jsonb_array_elements(c->'education') e),
       array(select distinct e->>'degree' from jsonb_array_elements(c->'education') e),
       array(select distinct e->>'field' from jsonb_array_elements(c->'education') e),
       coalesce(c->'experiences', '[]'), coalesce(c->'education', '[]')
     from jsonb_array_elements($1::jsonb) c
     on conflict (id) do nothing`,
    [raw],
  );
  const { rows } = await db.query("select count(*)::int as n from public.candidates");
  console.log(`candidates: ${rows[0].n}`);
}

async function createRecruiters(db: Client) {
  const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const r of RECRUITERS) {
    let userId: string | undefined;
    const created = await admin.auth.admin.createUser({
      email: r.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.data.user) {
      userId = created.data.user.id;
    } else {
      // already exists from a previous run
      const { data } = await admin.auth.admin.listUsers();
      userId = data.users.find((u) => u.email === r.email)?.id;
    }
    if (!userId) throw new Error(`could not create ${r.email}: ${created.error?.message}`);
    await db.query(
      `insert into public.recruiters (user_id, company_id) values ($1, $2)
       on conflict (user_id) do update set company_id = excluded.company_id`,
      [userId, r.company],
    );
    console.log(`recruiter: ${r.email} -> ${r.company}`);
  }
}

async function main() {
  const db = new Client({ connectionString: env("SUPABASE_DB_URL") });
  await db.connect();
  try {
    await loadCandidates(db);
    if (!process.argv.includes("--no-users")) await createRecruiters(db);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
