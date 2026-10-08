"use client";
import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { type Chip, chipsFor, KINDS, type Kind, removeChip } from "@/lib/filter-labels";
import type { Filters } from "@/lib/filters";
import { CITIES, COMPANIES, DEGREES, FIELDS, ROLES, SCHOOLS, SENIORITY, SKILLS } from "@/lib/vocab";
import { Button } from "./ui";

const LISTS: Partial<Record<Kind, readonly string[]>> = {
  roles: ROLES,
  seniority: SENIORITY,
  cities: CITIES,
  skills: SKILLS,
  nice_to_have_skills: SKILLS,
  companies: COMPANIES,
  current_companies: COMPANIES,
  schools: SCHOOLS,
  degrees: DEGREES,
  fields: FIELDS,
};

export function FilterBar({
  filters,
  busy,
  onChange,
  readOnly,
}: {
  filters: Filters;
  busy?: boolean;
  onChange?: (f: Filters) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<Kind | "menu" | null>(null);
  const chips = chipsFor(filters);
  const apply = (f: Filters) => {
    setEditing(null);
    onChange?.(f);
  };

  return (
    <div>
      <ul className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Filters">
        {chips.map((c) => (
          <li key={`${c.kind}:${c.value ?? ""}`}>
            <Mark chip={c} readOnly={readOnly || busy} onEdit={() => setEditing(c.kind)} onRemove={() => apply(removeChip(filters, c))} />
          </li>
        ))}
        {filters.unsupported.map((u) => (
          <li key={`u:${u}`}>
            <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-warn/60 bg-warn-soft py-0.5 pr-1 pl-2 text-[14px] text-warn">
              <span className="line-through decoration-warn/40">{u}</span>
              {!readOnly && (
                <button
                  disabled={busy}
                  onClick={() => apply({ ...filters, unsupported: filters.unsupported.filter((x) => x !== u) })}
                  aria-label={`Remove ${u}`}
                  title="Remove and search on the rest"
                  className="rounded p-0.5 hover:bg-warn/10"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          </li>
        ))}
        {!readOnly && (
          <li>
            <button
              disabled={busy}
              onClick={() => setEditing(editing === "menu" ? null : "menu")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[14px] font-medium text-muted hover:bg-black/5 hover:text-ink disabled:opacity-50"
              aria-expanded={editing === "menu"}
            >
              <Plus className="size-3.5" /> Add filter
            </button>
          </li>
        )}
      </ul>

      {editing === "menu" && (
        <Panel>
          <p className="mb-2 text-sm text-muted">Filter by</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {KINDS.map((k) => (
              <button key={k.kind} onClick={() => setEditing(k.kind)} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                {k.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}
      {editing && editing !== "menu" && (
        <Editor key={editing} kind={editing} filters={filters} onCancel={() => setEditing(null)} onApply={apply} />
      )}
    </div>
  );
}

function Mark({ chip, onEdit, onRemove, readOnly }: { chip: Chip; onEdit: () => void; onRemove: () => void; readOnly?: boolean }) {
  if (readOnly) return <span className="mark rounded-[5px] px-1.5 py-0.5 text-[14px] text-marker-ink">{chip.label}</span>;
  return (
    <span className="mark inline-flex items-center rounded-[5px] text-[14px] text-marker-ink">
      <button onClick={onEdit} className="rounded-l-[5px] py-0.5 pl-1.5 hover:underline" title="Edit">
        {chip.label}
      </button>
      <button onClick={onRemove} aria-label={`Remove ${chip.label}`} className="rounded-r-[5px] px-1 py-1 hover:bg-black/10">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="sheet-in mt-3 rounded-xl border border-line bg-surface p-4 shadow-sm">{children}</div>;
}

function Editor({ kind, filters, onApply, onCancel }: { kind: Kind; filters: Filters; onApply: (f: Filters) => void; onCancel: () => void }) {
  const label = KINDS.find((k) => k.kind === kind)!.label;
  const [draft, setDraft] = useState<Filters>(() => structuredClone(filters));

  let body: React.ReactNode;
  const list = LISTS[kind];
  if (list) {
    const key = kind as keyof Filters & ("roles" | "skills");
    body = <Checklist options={list} value={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} />;
  } else if (kind === "years") {
    const num = (s: string) => (s === "" ? null : Math.max(0, Math.min(60, Math.round(Number(s)))));
    body = (
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          At least
          <input type="number" min={0} max={60} inputMode="numeric" value={draft.min_years ?? ""} onChange={(e) => setDraft({ ...draft, min_years: num(e.target.value) })} className="h-9 w-20 rounded-lg border border-line px-2" />
        </label>
        <label className="flex items-center gap-2">
          at most
          <input type="number" min={0} max={60} inputMode="numeric" value={draft.max_years ?? ""} onChange={(e) => setDraft({ ...draft, max_years: num(e.target.value) })} className="h-9 w-20 rounded-lg border border-line px-2" />
        </label>
        years
      </div>
    );
  } else if (kind === "open_to_work") {
    body = (
      <Choice
        options={[
          ["any", "Anyone"],
          ["yes", "Open to work"],
          ["no", "Not open to work"],
        ]}
        value={draft.open_to_work === null ? "any" : draft.open_to_work ? "yes" : "no"}
        onChange={(v) => setDraft({ ...draft, open_to_work: v === "any" ? null : v === "yes" })}
      />
    );
  } else {
    const key = kind as "worked_at_company_type" | "current_company_type";
    body = (
      <Choice
        options={[
          ["any", "Any company"],
          ["startup", "A startup"],
          ["enterprise", "An enterprise"],
        ]}
        value={draft[key] ?? "any"}
        onChange={(v) => setDraft({ ...draft, [key]: v === "any" ? null : v })}
      />
    );
  }

  return (
    <Panel>
      <p className="mb-3 text-sm font-medium">{label}</p>
      {body}
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={() => onApply(draft)}>
          Update search
        </Button>
      </div>
    </Panel>
  );
}

function Checklist({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  // what's already picked stays on top, in the order it was opened with
  const [picked] = useState(value);
  const shown = useMemo(() => {
    const m = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
    return [...m.filter((o) => picked.includes(o)), ...m.filter((o) => !picked.includes(o))];
  }, [options, q, picked]);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div>
      {options.length > 8 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="mb-2 h-9 w-full rounded-lg border border-line px-3 text-sm"
        />
      )}
      <div className="grid max-h-56 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
        {shown.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              role="checkbox"
              aria-checked={on}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper"
            >
              <span className={`flex size-4 items-center justify-center rounded border ${on ? "border-ink bg-ink text-white" : "border-line"}`}>
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </button>
          );
        })}
        {!shown.length && <p className="px-2 py-1.5 text-sm text-muted">Nothing matches “{q}”.</p>}
      </div>
    </div>
  );
}

function Choice({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${value === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink/30"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
