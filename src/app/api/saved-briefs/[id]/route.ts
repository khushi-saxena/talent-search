import { auth, dbError, fail, isUuid, json } from "@/lib/api";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, "Saved search not found");

  const { data, error } = await ctx.db.from("saved_briefs").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(404, "Saved search not found");
  return json({ ok: true });
}
