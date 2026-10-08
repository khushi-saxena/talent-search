"use client";
import { Check, ListPlus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Shortlist } from "@/lib/client-api";
import { useApp } from "./app-context";

// Toggle a candidate on any of the company's shortlists, or start a new one.
export function ShortlistButton({ personId, compact }: { personId: string; compact?: boolean }) {
  const { shortlists, setShortlists, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const on = shortlists?.filter((s) => s.person_ids.includes(personId)) ?? [];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const patch = (id: string, f: (s: Shortlist) => Shortlist) =>
    setShortlists((all) => all?.map((s) => (s.id === id ? f(s) : s)) ?? all);

  async function toggle(s: Shortlist) {
    const has = s.person_ids.includes(personId);
    // optimistic, rolled back on failure
    patch(s.id, (x) => ({ ...x, person_ids: has ? x.person_ids.filter((p) => p !== personId) : [...x.person_ids, personId] }));
    try {
      await api(`/api/shortlists/${s.id}/people/${personId}`, { method: has ? "DELETE" : "POST" });
      toast(has ? `Removed from ${s.name}` : `Added to ${s.name}`);
    } catch (e) {
      patch(s.id, () => s);
      toast((e as Error).message);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/shortlists", { method: "POST", body: { name: n } });
      await api(`/api/shortlists/${id}/people/${personId}`, { method: "POST" });
      setShortlists((all) => [...(all ?? []), { id, name: n, created_at: new Date().toISOString(), person_ids: [personId] }]);
      setName("");
      toast(`Added to ${n}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saved = on.length > 0;
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={saved ? `Shortlisted in ${on.map((s) => s.name).join(", ")}` : "Shortlist"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] border text-sm font-medium transition-colors ${
          compact ? "w-9 justify-center" : "px-3"
        } ${saved ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-ink/30"}`}
      >
        {saved ? <Check className="size-4" /> : <ListPlus className="size-4" />}
        {!compact && (saved ? (on.length === 1 ? on[0].name : `${on.length} lists`) : "Shortlist")}
      </button>
      {open && (
        <div role="menu" className="sheet-in absolute right-0 z-40 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {shortlists === null ? (
            <p className="px-2 py-2 text-sm text-muted">Loading lists…</p>
          ) : shortlists.length === 0 ? (
            <p className="px-2 pt-1 pb-2 text-sm text-muted">No shortlists yet. Name one to start.</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {shortlists.map((s) => {
                const has = s.person_ids.includes(personId);
                return (
                  <li key={s.id}>
                    <button
                      role="menuitemcheckbox"
                      aria-checked={has}
                      onClick={() => toggle(s)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-paper"
                    >
                      <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${has ? "border-ink bg-ink text-white" : "border-line"}`}>
                        {has && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto text-xs text-faint">{s.person_ids.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={create} className="mt-1 flex gap-1 border-t border-line pt-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="New shortlist"
              aria-label="New shortlist name"
              className="h-8 min-w-0 flex-1 rounded-lg px-2 text-sm outline-none focus:bg-paper"
            />
            <button disabled={!name.trim() || busy} aria-label="Create and add" className="flex size-8 items-center justify-center rounded-lg text-ink hover:bg-paper disabled:text-faint">
              <Plus className="size-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
