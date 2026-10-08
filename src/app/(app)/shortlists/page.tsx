"use client";
import { ChevronRight, List } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, plural } from "@/components/ui";
import { api } from "@/lib/client-api";

export default function ShortlistsPage() {
  const { shortlists, setShortlists, toast } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/shortlists", { method: "POST", body: { name: n } });
      setShortlists((all) => [...(all ?? []), { id, name: n, created_at: new Date().toISOString(), person_ids: [] }]);
      setName("");
      toast(`Created ${n}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Shortlists</h1>
      <p className="mt-1 text-[15px] text-muted">Shared with everyone at your company.</p>

      <form onSubmit={create} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Name a new shortlist"
          aria-label="New shortlist name"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-[15px] outline-none focus:border-ink/40"
        />
        <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
          Create
        </Button>
      </form>

      <div className="mt-5">
        {shortlists === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : shortlists.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
            <List className="size-6 text-faint" aria-hidden />
            <p className="mt-3 font-medium">No shortlists yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create one here, or choose Shortlist on any candidate in your search results.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {shortlists.map((s) => (
              <li key={s.id}>
                <Link href={`/shortlists/${s.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-paper/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-sm text-muted">{plural(s.person_ids.length, "person", "people")}</p>
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
