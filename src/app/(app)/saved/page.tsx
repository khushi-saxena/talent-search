"use client";
import { Bookmark, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { FilterBar } from "@/components/filter-bar";
import { Button, ErrorNote } from "@/components/ui";
import { api, ApiError, type SavedBrief, type SearchResponse } from "@/lib/client-api";

export default function SavedPage() {
  const router = useRouter();
  const { plan, setPlan, setUpgradeOpen, refreshPlan, toast } = useApp();
  const [items, setItems] = useState<SavedBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await api<SavedBrief[]>("/api/saved-briefs"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const outOfSearches = plan?.plan === "free" && plan.searches_remaining === 0;

  async function rerun(s: SavedBrief) {
    if (outOfSearches) return setUpgradeOpen(true);
    setRunning(s.id);
    try {
      // re-runs with the saved filters, so the model isn't asked again
      const r = await api<SearchResponse>("/api/search", { method: "POST", body: { brief: s.brief, filters: s.filters } });
      setPlan({ plan: r.searches_remaining === null ? "paid" : "free", searches_remaining: r.searches_remaining });
      router.push(`/?s=${r.search_id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        refreshPlan();
        setUpgradeOpen(true);
      } else toast((e as Error).message);
      setRunning(null);
    }
  }

  async function remove(s: SavedBrief) {
    setItems((all) => all?.filter((x) => x.id !== s.id) ?? all);
    try {
      await api(`/api/saved-briefs/${s.id}`, { method: "DELETE" });
      toast("Saved search deleted");
    } catch (e) {
      toast((e as Error).message);
      load();
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Saved searches</h1>
      <p className="mt-1 text-[15px] text-muted">Run a search again with the same filters. Shared with everyone at your company.</p>

      <div className="mt-6">
        {error && <ErrorNote message={error} onRetry={load} />}
        {!items && !error && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}
        {items?.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <Bookmark className="size-6 text-faint" aria-hidden />
            <p className="mt-3 font-medium">No saved searches yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Run a search, then choose Save search above the results to keep it here.</p>
            <Button className="mt-4" size="sm" onClick={() => router.push("/")}>
              Start a search
            </Button>
          </div>
        )}
        {!!items?.length && (
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-surface p-4 md:p-5">
                <p className="text-[16px] font-medium">{s.brief}</p>
                <div className="mt-3">
                  <FilterBar filters={s.filters} readOnly />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-faint">Saved {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label={`Delete saved search “${s.brief}”`}>
                      <Trash2 className="size-4" />
                    </Button>
                    <Button size="sm" variant="primary" loading={running === s.id} disabled={!!running} onClick={() => rerun(s)}>
                      Run search
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!!items?.length && plan?.plan === "free" && (
          <p className="mt-4 text-[13px] text-muted">
            {outOfSearches ? "Running a saved search counts as a new search, and your free search is used. " : "Running a saved search counts as a new search. "}
            <button onClick={() => setUpgradeOpen(true)} className="font-medium text-ink underline underline-offset-2">
              See plans
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
