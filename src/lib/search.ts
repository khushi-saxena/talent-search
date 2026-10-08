import "server-only";
import { type Ctx, dbError, fail, json } from "./api";
import { type Filters, hasConstraints, normalizeFilters } from "./filters";
import { briefToFilters } from "./llm";

export const PAGE_SIZE = 20;
export const MAX_BRIEF = 500;

// Why a search returned nothing on purpose, for the UI.
function skipReason(f: Filters) {
  if (f.unsupported.length) return `Can't search on: ${f.unsupported.join(", ")}`;
  if (!hasConstraints(f)) return "Add something to search for, like a role, skill or city.";
  return null;
}

export async function runSearch(ctx: Ctx, brief: string, edited?: unknown) {
  const { data: plan, error: planErr } = await ctx.db.rpc("plan_status").single<{ searches_remaining: number | null }>();
  if (planErr) return dbError(planErr);
  // cheap early exit; create_search is still the real gate
  if (plan.searches_remaining === 0) return limitReached();

  let filters: Filters;
  if (edited !== undefined) {
    try {
      filters = normalizeFilters(edited);
    } catch {
      return fail(400, "Invalid filters");
    }
  } else {
    try {
      filters = (await briefToFilters(brief)).filters;
    } catch (e) {
      console.error("filter extraction failed", e);
      return fail(502, "Couldn't understand the brief right now. Try again in a moment.");
    }
  }

  const reason = skipReason(filters);
  const { data, error } = await ctx.db
    .rpc("create_search", { p_brief: brief, p_filters: filters, p_match: reason === null })
    .single<{ search_id: string; total: number; searches_remaining: number | null }>();
  if (error) return error.code === "P0402" ? limitReached() : dbError(error);

  const page = await getPage(ctx, data.search_id, 1);
  if (page instanceof Response) return page;

  return json({
    search_id: data.search_id,
    filters,
    total: data.total,
    results: page.results,
    searches_remaining: data.searches_remaining,
    note: reason,
  });
}

export async function getPage(ctx: Ctx, searchId: string, page: number) {
  const { data, error } = await ctx.db.rpc("search_page", { p_search_id: searchId, p_page: page, p_size: PAGE_SIZE });
  if (error) return dbError(error);
  if (!data) return fail(404, "Search not found");
  return data as { search_id: string; brief: string; filters: Filters; total: number; results: unknown[] };
}

const limitReached = () =>
  json(
    {
      error: "Your free search has been used. Upgrade to the paid plan for unlimited searches.",
      code: "search_limit",
      searches_remaining: 0,
    },
    402,
  );
