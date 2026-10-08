import { auth, fail, isUuid, json } from "@/lib/api";
import { getPage } from "@/lib/search";

export async function GET(req: Request, { params }: { params: Promise<{ search_id: string }> }) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const { search_id } = await params;
  if (!isUuid(search_id)) return fail(404, "Search not found");
  const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return fail(400, "page must be a positive integer");

  const res = await getPage(ctx, search_id, page);
  if (res instanceof Response) return res;
  return json({ ...res, page });
}
