import { auth, dbError, fail, json } from "@/lib/api";

const COLUMNS =
  "id, full_name, avatar_url, headline, current_title, current_company, current_company_logo_url, role, seniority, years_experience, city, state, country, open_to_work, skills, experiences, education";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const { data, error } = await ctx.db.from("candidates").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return dbError(error);
  if (!data) return fail(404, "Candidate not found");

  const { city, state, country, ...rest } = data;
  return json({ ...rest, location: { city, state, country } });
}
