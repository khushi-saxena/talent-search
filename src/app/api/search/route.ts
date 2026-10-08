import { auth, body, fail } from "@/lib/api";
import { MAX_BRIEF, runSearch } from "@/lib/search";

export async function POST(req: Request) {
  const ctx = await auth(req);
  if (ctx instanceof Response) return ctx;

  const b = await body<{ brief?: unknown; filters?: unknown }>(req);
  const brief = typeof b?.brief === "string" ? b.brief.trim() : "";
  if (!brief) return fail(400, "brief is required");
  if (brief.length > MAX_BRIEF) return fail(400, `brief must be ${MAX_BRIEF} characters or fewer`);

  // filters are sent when the recruiter edits what we understood
  return runSearch(ctx, brief, b?.filters ?? undefined);
}
