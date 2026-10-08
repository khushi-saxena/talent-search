"use client";
import { ArrowLeft, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Person } from "@/lib/client-api";
import { useApp } from "./app-context";
import { ShortlistButton } from "./shortlist-button";
import { Avatar, ErrorNote, Logo } from "./ui";

export function PersonPanel() {
  const { personId, openPerson } = useApp();
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string) => {
    setPerson(null);
    setError(null);
    try {
      setPerson(await api<Person>(`/api/people/${encodeURIComponent(id)}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!personId) return;
    load(personId);
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && openPerson(null);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [personId, load, openPerson]);

  if (!personId) return null;
  const close = () => openPerson(null);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={close}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={person?.full_name ?? "Candidate"}
        onClick={(e) => e.stopPropagation()}
        className="sheet-in flex h-full w-full flex-col bg-surface shadow-2xl outline-none md:max-w-[480px]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <button onClick={close} className="flex items-center gap-1.5 rounded-lg p-1 text-sm font-medium text-muted hover:text-ink md:hidden">
            <ArrowLeft className="size-4" /> Back
          </button>
          <span className="hidden text-sm text-muted md:block">Candidate</span>
          <button onClick={close} aria-label="Close" className="hidden rounded-lg p-1 text-muted hover:text-ink md:block">
            <X className="size-5" />
          </button>
        </div>
        <div className="pb-safe flex-1 overflow-y-auto">
          {error && (
            <div className="p-5">
              <ErrorNote message={error} onRetry={() => load(personId)} />
            </div>
          )}
          {!person && !error && <PanelSkeleton />}
          {person && <Profile person={person} />}
        </div>
      </div>
    </div>
  );
}

function Profile({ person: p }: { person: Person }) {
  const exp = [...p.experiences].sort((a, b) => (b.end_year ?? 9999) - (a.end_year ?? 9999) || b.start_year - a.start_year);
  return (
    <div className="px-5 py-6">
      <div className="flex items-start gap-4">
        <Avatar src={p.avatar_url} name={p.full_name} size={72} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-semibold">{p.full_name}</h2>
          <p className="mt-1 text-[15px] text-muted">{p.headline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-faint" aria-hidden />
              {[p.location.city, p.location.state].filter(Boolean).join(", ")}
            </span>
            <span>{p.years_experience === 1 ? "1 year" : `${p.years_experience} years`} experience</span>
            {p.open_to_work && <span className="rounded-full bg-go-soft px-2 py-px text-xs font-semibold text-go">Open to work</span>}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <ShortlistButton personId={p.id} />
      </div>

      <Section title="Experience">
        <ol className="space-y-5">
          {exp.map((e, i) => (
            <li key={i} className="flex gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                <Logo src={e.company_logo_url} size={22} />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-muted">
                  {e.company} <span className="text-faint">({e.company_type})</span>
                </p>
                <p className="text-sm text-faint">
                  {e.start_year} – {e.end_year ?? "now"}
                </p>
                {e.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{e.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Education">
        <ul className="space-y-3">
          {p.education.map((e, i) => (
            <li key={i}>
              <p className="font-medium">{e.school}</p>
              <p className="text-sm text-muted">
                {e.degree}, {e.field}
                {e.graduation_year ? <span className="text-faint">, {e.graduation_year}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Skills">
        <ul className="flex flex-wrap gap-1.5">
          {p.skills.map((s) => (
            <li key={s} className="rounded-md bg-paper px-2 py-1 text-sm">
              {s}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function PanelSkeleton() {
  return (
    <div aria-label="Loading" className="px-5 py-6">
      <div className="flex gap-4">
        <div className="skeleton size-[72px] rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-56" />
          <div className="skeleton h-3 w-32" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  );
}
