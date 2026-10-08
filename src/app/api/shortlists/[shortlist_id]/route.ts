import { auth, body, dbError, fail, isUuid, json } from "@/lib/api";

type Params = { params: Promise<{ shortlist_id: string }> };

const CARD =
  "id, full_name, avatar_url, headline, current_title, current_company, current_company_logo_url, role, seniority, years_experience, city, state, country, open_to_work, skills";

export async function GET(req: Request, { params }: Params) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { shortlist_id } = await params;
  if (!isUuid(shortlist_id)) return fail(404, "Shortlist not found");

  const { data, error } = await ctx.db
    .from("shortlists")
    .select(`id, name, created_at, shortlist_people(added_at, candidates(${CARD}))`)
    .eq("id", shortlist_id)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "Shortlist not found");

  type Row = { added_at: string; candidates: Record<string, unknown> & { city: string; state: string; country: string } };
  const people = (data.shortlist_people as unknown as Row[])
    .sort((a, b) => b.added_at.localeCompare(a.added_at))
    .map(({ candidates: { city, state, country, ...c } }) => ({ ...c, location: { city, state, country } }));
  return json({ id: data.id, name: data.name, created_at: data.created_at, people });
}

// rename
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { shortlist_id } = await params;
  if (!isUuid(shortlist_id)) return fail(404, "Shortlist not found");

  const b = await body(req);
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 80) return fail(400, "name must be 1 to 80 characters");

  const { data, error } = await ctx.db.from("shortlists").update({ name }).eq("id", shortlist_id).select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(404, "Shortlist not found");
  return json({ id: shortlist_id, name });
}

export async function DELETE(req: Request, { params }: Params) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { shortlist_id } = await params;
  if (!isUuid(shortlist_id)) return fail(404, "Shortlist not found");

  const { data, error } = await ctx.db.from("shortlists").delete().eq("id", shortlist_id).select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(404, "Shortlist not found");
  return json({ ok: true });
}
