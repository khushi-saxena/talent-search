import { auth, body, dbError, fail, json } from "@/lib/api";
import { normalizeFilters } from "@/lib/filters";
import { MAX_BRIEF } from "@/lib/search";

export async function GET(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.db
    .from("saved_briefs")
    .select("id, brief, filters, created_at")
    .order("created_at", { ascending: false });
  if (error) return dbError(error);
  return json(data);
}

export async function POST(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const b = await body(req);
  const brief = typeof b?.brief === "string" ? b.brief.trim() : "";
  if (!brief || brief.length > MAX_BRIEF) return fail(400, `brief must be 1 to ${MAX_BRIEF} characters`);

  let filters;
  try {
    filters = normalizeFilters(b?.filters ?? {});
  } catch {
    return fail(400, "Invalid filters");
  }

  const { data, error } = await ctx.db
    .from("saved_briefs")
    .insert({ brief, filters, user_id: ctx.userId })
    .select("id, brief, filters, created_at")
    .single();
  if (error) return dbError(error);
  return json(data);
}
