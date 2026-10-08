import { z } from "zod";
import {
  CITIES,
  COMPANIES,
  COMPANY_TYPES,
  DEGREES,
  FIELDS,
  ROLES,
  SCHOOLS,
  SENIORITY,
  SKILLS,
} from "./vocab";

// Filters are the contract between the model, the UI and Postgres.
// Every list value must come from the candidate data.
export type Filters = {
  roles: string[];
  seniority: string[];
  cities: string[];
  skills: string[];
  nice_to_have_skills: string[];
  companies: string[];
  current_companies: string[];
  schools: string[];
  degrees: string[];
  fields: string[];
  open_to_work: boolean | null;
  min_years: number | null;
  max_years: number | null;
  worked_at_company_type: string | null;
  current_company_type: string | null;
  // parts of the brief the data can't answer
  unsupported: string[];
};

export const LIST_KEYS = [
  "roles",
  "seniority",
  "cities",
  "skills",
  "nice_to_have_skills",
  "companies",
  "current_companies",
  "schools",
  "degrees",
  "fields",
] as const;

export const VOCAB: Record<(typeof LIST_KEYS)[number], readonly string[]> = {
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

export const emptyFilters = (): Filters => ({
  roles: [],
  seniority: [],
  cities: [],
  skills: [],
  nice_to_have_skills: [],
  companies: [],
  current_companies: [],
  schools: [],
  degrees: [],
  fields: [],
  open_to_work: null,
  min_years: null,
  max_years: null,
  worked_at_company_type: null,
  current_company_type: null,
  unsupported: [],
});

const loose = z
  .object({
    ...Object.fromEntries(LIST_KEYS.map((k) => [k, z.array(z.string()).max(50).optional()])),
    open_to_work: z.boolean().nullish(),
    min_years: z.number().nullish(),
    max_years: z.number().nullish(),
    worked_at_company_type: z.string().nullish(),
    current_company_type: z.string().nullish(),
    unsupported: z.array(z.string()).max(20).optional(),
  })
  .partial();

const canon = (vocab: readonly string[], value: string) =>
  vocab.find((v) => v.toLowerCase() === value.trim().toLowerCase());

const years = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(60, Math.max(0, Math.round(n))) : null;

// Turns anything (model output, a saved search, an edited chip set from the
// browser) into valid Filters. Values outside the data become "unsupported"
// rather than silently disappearing, so the search can't widen.
export function normalizeFilters(input: unknown): Filters {
  const parsed = loose.safeParse(input);
  if (!parsed.success) throw new Error("invalid filters");
  const raw = parsed.data as Record<string, unknown>;
  const f = emptyFilters();
  const unsupported = new Set(
    ((raw.unsupported as string[] | undefined) ?? []).map((s) => s.trim().slice(0, 80)).filter(Boolean),
  );

  for (const key of LIST_KEYS) {
    const vals = (raw[key] as string[] | undefined) ?? [];
    for (const v of vals) {
      const c = canon(VOCAB[key], v);
      if (c) {
        if (!f[key].includes(c)) f[key].push(c);
      } else if (v.trim()) {
        // a nice-to-have that doesn't exist can't hurt, just drop it
        if (key !== "nice_to_have_skills") unsupported.add(v.trim().slice(0, 80));
      }
    }
  }
  // a required skill doesn't also need to be a nice-to-have
  f.nice_to_have_skills = f.nice_to_have_skills.filter((s) => !f.skills.includes(s));

  f.open_to_work = typeof raw.open_to_work === "boolean" ? raw.open_to_work : null;
  f.min_years = years(raw.min_years as number | null);
  f.max_years = years(raw.max_years as number | null);

  for (const key of ["worked_at_company_type", "current_company_type"] as const) {
    const v = raw[key] as string | null | undefined;
    if (v) {
      const c = canon(COMPANY_TYPES, v);
      if (c) f[key] = c;
      else unsupported.add(v.slice(0, 80));
    }
  }

  f.unsupported = [...unsupported];
  return f;
}

// true when the filters narrow the pool at all
export function hasConstraints(f: Filters) {
  return (
    LIST_KEYS.some((k) => k !== "nice_to_have_skills" && f[k].length > 0) ||
    f.open_to_work !== null ||
    f.min_years !== null ||
    f.max_years !== null ||
    f.worked_at_company_type !== null ||
    f.current_company_type !== null
  );
}
