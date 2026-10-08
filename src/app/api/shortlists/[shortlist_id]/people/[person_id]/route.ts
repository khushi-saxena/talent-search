import { auth, dbError, fail, isUuid, json, type Ctx } from "@/lib/api";

type Params = { params: Promise<{ shortlist_id: string; person_id: string }> };

// RLS hides other companies' lists, so "not visible" and "not found" look the same
async function ownsList(ctx: Ctx, id: string) {
  if (!isUuid(id)) return false;
  const { data } = await ctx.db.from("shortlists").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { shortlist_id, person_id } = await params;
  if (!(await ownsList(ctx, shortlist_id))) return fail(404, "Shortlist not found");

  // adding someone twice is a no-op
  const { error } = await ctx.db
    .from("shortlist_people")
    .upsert({ shortlist_id, candidate_id: person_id }, { onConflict: "shortlist_id,candidate_id", ignoreDuplicates: true });
  if (error) return error.code === "23503" ? fail(404, "Candidate not found") : dbError(error);
  return json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { shortlist_id, person_id } = await params;
  if (!(await ownsList(ctx, shortlist_id))) return fail(404, "Shortlist not found");

  const { error } = await ctx.db
    .from("shortlist_people")
    .delete()
    .eq("shortlist_id", shortlist_id)
    .eq("candidate_id", person_id);
  if (error) return dbError(error);
  return json({ ok: true });
}
