import { auth, body, dbError, fail, isUuid, json } from "@/lib/api";

type Params = { params: Promise<{ shortlist_id: string }> };

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
