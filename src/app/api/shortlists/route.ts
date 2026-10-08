import { auth, body, dbError, fail, json } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.db
    .from("shortlists")
    .select("id, name, created_at, shortlist_people(candidate_id)")
    .order("created_at", { ascending: true });
  if (error) return dbError(error);

  return json(
    data.map(({ shortlist_people, ...s }) => ({
      ...s,
      person_ids: shortlist_people.map((p) => p.candidate_id),
    })),
  );
}

export async function POST(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const b = await body(req);
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 80) return fail(400, "name must be 1 to 80 characters");

  // company_id is set by a trigger from the token, never from the request
  const { data, error } = await ctx.db.from("shortlists").insert({ name }).select("id").single();
  if (error) return dbError(error);
  return json({ id: data.id }, 201);
}
