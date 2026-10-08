"use client";
import { ArrowUp, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-context";
import { FilterBar } from "@/components/filter-bar";
import { PersonRow } from "@/components/person-row";
import { Button, ErrorNote, plural, RowSkeleton } from "@/components/ui";
import { api, ApiError, type Card, type PageResponse, type SearchResponse } from "@/lib/client-api";
import { chipsFor } from "@/lib/filter-labels";
import type { Filters } from "@/lib/filters";

const EXAMPLES = [
  "Senior React engineers in New York who have worked at a startup",
  "Product designers in San Francisco who are open to work",
  "Data scientists with a PhD",
];

type Result = { searchId: string; brief: string; filters: Filters; total: number; page: number; results: Card[]; note?: string | null };

export default function SearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

function Search() {
  const router = useRouter();
  const params = useSearchParams();
  const searchId = params.get("s");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { plan, setPlan, refreshPlan, setUpgradeOpen, toast } = useApp();

  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<"search" | "page" | null>(null);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // grow with the brief instead of scrolling inside the box
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [brief, result]);

  const outOfSearches = plan?.plan === "free" && plan.searches_remaining === 0;

  // load a page of an existing search (from the URL, or after paging)
  const loadPage = useCallback(async (id: string, p: number) => {
    setPending("page");
    setError(null);
    try {
      const r = await api<PageResponse>(`/api/search/${id}?page=${p}`);
      setResult((prev) => ({
        searchId: id,
        brief: r.brief,
        filters: r.filters,
        total: r.total,
        page: p,
        results: r.results,
        note: prev?.searchId === id ? prev.note : null,
      }));
      setBrief((b) => b || r.brief);
    } catch (e) {
      setError({ message: (e as Error).message, retry: () => loadPage(id, p) });
    } finally {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    if (!searchId) {
      setResult(null);
      return;
    }
    if (result?.searchId === searchId && result.page === page) return;
    loadPage(searchId, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, page]);

  async function run(text: string, filters?: Filters) {
    const b = text.trim();
    if (!b || pending) return;
    if (outOfSearches) return setUpgradeOpen(true);
    setPending("search");
    setError(null);
    try {
      const r = await api<SearchResponse>("/api/search", { method: "POST", body: { brief: b, filters } });
      setResult({ searchId: r.search_id, brief: b, filters: r.filters, total: r.total, page: 1, results: r.results, note: r.note });
      setPlan({ plan: r.searches_remaining === null ? "paid" : "free", searches_remaining: r.searches_remaining });
      router.push(`/?s=${r.search_id}`, { scroll: false });
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        refreshPlan();
        setUpgradeOpen(true);
        setError({ message: "Your free search has been used. Upgrade to keep searching." });
      } else {
        setError({ message: (e as Error).message, retry: () => run(b, filters) });
      }
    } finally {
      setPending(null);
    }
  }

  function goTo(p: number) {
    if (!result) return;
    router.push(`/?s=${result.searchId}&page=${p}`, { scroll: false });
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    try {
      await api("/api/saved-briefs", { method: "POST", body: { brief: result.brief, filters: result.filters } });
      setSavedKey(result.searchId);
      toast("Search saved");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / 20)) : 1;
  const highlight = result ? [...result.filters.skills, ...result.filters.nice_to_have_skills] : [];
  const editedBrief = result && brief.trim() !== result.brief;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(brief);
        }}
        className={result || pending ? "" : "pt-6 md:pt-16"}
      >
        {!result && !pending && (
          <h1 className="mb-5 text-[28px] leading-tight font-semibold tracking-tight md:text-[40px]">Who are you looking for?</h1>
        )}
        <div className="relative rounded-2xl border border-line bg-surface shadow-sm transition-colors focus-within:border-ink/40">
          <label htmlFor="brief" className="sr-only">
            Describe who you're looking for
          </label>
          <textarea
            id="brief"
            value={brief}
            ref={input}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(brief);
              }
            }}
            rows={result ? 1 : 2}
            maxLength={500}
            placeholder="Senior React engineers in New York who have worked at a startup"
            className="block w-full resize-none bg-transparent focus-visible:outline-none px-4 pt-3.5 pr-16 pb-3.5 text-[17px] leading-snug outline-none placeholder:text-faint md:text-lg"
          />
          <button
            type="submit"
            disabled={!brief.trim() || !!pending}
            aria-label="Search"
            className="absolute right-2.5 bottom-2.5 flex size-10 items-center justify-center rounded-xl bg-ink text-white transition-colors hover:bg-black disabled:bg-ink/25"
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
        {plan?.plan === "free" && (!result || editedBrief) && (
          <p className="mt-2 px-1 text-[13px] text-muted">
            {outOfSearches ? (
              <>
                Your free search is used.{" "}
                <button type="button" onClick={() => setUpgradeOpen(true)} className="font-medium text-ink underline underline-offset-2">
                  Upgrade to search again
                </button>
              </>
            ) : (
              "The free plan includes 1 search. Paging through results doesn't use it up."
            )}
          </p>
        )}
      </form>

      {!result && !pending && !error && (
        <div className="mt-8">
          <p className="mb-2 text-sm text-muted">Try</p>
          <ul className="space-y-1">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button onClick={() => setBrief(ex)} className="text-left text-[15px] text-ink/80 underline decoration-line underline-offset-4 hover:decoration-ink">
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={top} className="scroll-mt-20" />

      {error && (
        <div className="mt-5">
          <ErrorNote message={error.message} onRetry={error.retry} />
        </div>
      )}

      {pending === "search" && (
        <div className="mt-6" aria-live="polite">
          <p className="mb-3 text-sm text-muted">Reading your brief…</p>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <RowSkeleton />
          </div>
        </div>
      )}

      {result && pending !== "search" && (
        <section className="mt-5" aria-busy={pending === "page"}>
          <div className="mb-1.5 text-[13px] text-muted">Searching for</div>
          <FilterBar key={result.searchId} filters={result.filters} busy={!!pending} onChange={(f) => run(result.brief, f)} />

          <div className="mt-6 mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold" aria-live="polite">
              {result.total ? plural(result.total, "person", "people") : "No matches"}
            </h2>
            <Button
              size="sm"
              variant={savedKey === result.searchId ? "ghost" : "secondary"}
              onClick={save}
              loading={saving}
              disabled={savedKey === result.searchId}
            >
              {savedKey === result.searchId ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              {savedKey === result.searchId ? "Saved" : "Save search"}
            </Button>
          </div>

          {result.total === 0 ? (
            <Empty result={result} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {pending === "page" ? (
                <RowSkeleton count={8} />
              ) : (
                <ul className="divide-y divide-line">
                  {result.results.map((p) => (
                    <PersonRow key={p.id} person={p} highlight={highlight} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between" aria-label="Pages">
              <Button size="sm" disabled={result.page <= 1 || !!pending} onClick={() => goTo(result.page - 1)}>
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <span className="text-sm text-muted">
                {(result.page - 1) * 20 + 1}–{Math.min(result.page * 20, result.total)} of {result.total.toLocaleString()}
              </span>
              <Button size="sm" disabled={result.page >= pages || !!pending} onClick={() => goTo(result.page + 1)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}

function Empty({ result }: { result: Result }) {
  const unsupported = result.filters.unsupported;
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <SearchX className="size-6 text-faint" aria-hidden />
      {unsupported.length ? (
        <>
          <p className="mt-3 font-medium">Rotto can't search on {unsupported.map((u) => `“${u}”`).join(", ")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Candidate profiles don't include that, so we won't guess. Remove it above to search on the rest.
          </p>
        </>
      ) : chipsFor(result.filters).length === 0 ? (
        <>
          <p className="mt-3 font-medium">Nothing to search on yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Describe a role, skill, location or background, or add a filter above.</p>
        </>
      ) : (
        <>
          <p className="mt-3 font-medium">No one matches all of these</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Remove a filter above to widen the search.</p>
        </>
      )}
    </div>
  );
}
