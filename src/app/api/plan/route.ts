import { auth, dbError, json } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.db
    .rpc("plan_status")
    .single<{ plan: "free" | "paid"; searches_remaining: number | null }>();
  if (error) return dbError(error);
  return json({ plan: data.plan, searches_remaining: data.searches_remaining });
}
