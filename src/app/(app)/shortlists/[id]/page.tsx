"use client";
import { ArrowLeft, Pencil, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { PersonRow } from "@/components/person-row";
import { Button, Dialog, ErrorNote, plural, RowSkeleton } from "@/components/ui";
import { api, type Card } from "@/lib/client-api";

type Detail = { id: string; name: string; people: Card[] };

export default function ShortlistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setShortlists, toast } = useApp();
  const [list, setList] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setList(await api<Detail>(`/api/shortlists/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!list || !n) return;
    setBusy(true);
    try {
      await api(`/api/shortlists/${id}`, { method: "PATCH", body: { name: n } });
      setList({ ...list, name: n });
      setShortlists((all) => all?.map((s) => (s.id === id ? { ...s, name: n } : s)) ?? all);
      setRenaming(false);
      toast("Shortlist renamed");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/shortlists/${id}`, { method: "DELETE" });
      setShortlists((all) => all?.filter((s) => s.id !== id) ?? all);
      toast(`Deleted ${list?.name}`);
      router.push("/shortlists");
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
    }
  }

  async function removePerson(p: Card) {
    if (!list) return;
    setList({ ...list, people: list.people.filter((x) => x.id !== p.id) });
    setShortlists((all) => all?.map((s) => (s.id === id ? { ...s, person_ids: s.person_ids.filter((x) => x !== p.id) } : s)) ?? all);
    try {
      await api(`/api/shortlists/${id}/people/${p.id}`, { method: "DELETE" });
      toast(`Removed ${p.full_name}`);
    } catch (err) {
      toast((err as Error).message);
      load();
    }
  }

  return (
    <div>
      <Link href="/shortlists" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Shortlists
      </Link>

      {error && <ErrorNote message={error} onRetry={load} />}

      {!list && !error && (
        <>
          <div className="skeleton mb-6 h-8 w-56" />
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <RowSkeleton count={4} />
          </div>
        </>
      )}

      {list && (
        <>
          {renaming ? (
            <form onSubmit={rename} className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                aria-label="Shortlist name"
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-lg font-semibold outline-none focus:border-ink/40"
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
                Save
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{list.name}</h1>
                <p className="mt-1 text-[15px] text-muted">{plural(list.people.length, "person", "people")}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setName(list.name);
                    setRenaming(true);
                  }}
                >
                  <Pencil className="size-4" /> <span className="hidden sm:inline">Rename</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" /> <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6">
            {list.people.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
                <UserPlus className="size-6 text-faint" aria-hidden />
                <p className="mt-3 font-medium">No one on this list yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted">Choose Shortlist on a candidate in your search results to add them here.</p>
                <Button className="mt-4" size="sm" onClick={() => router.push("/")}>
                  Go to search
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {list.people.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    action={
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePerson(p);
                        }}
                        aria-label={`Remove ${p.full_name} from ${list.name}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-muted hover:bg-black/5 hover:text-ink"
                      >
                        <X className="size-4" /> <span className="hidden sm:inline">Remove</span>
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${list?.name ?? "shortlist"}?`}>
        <p className="text-[15px] text-muted">The list goes away for everyone at your company. The candidates stay in search.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={remove}>
            Delete shortlist
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
