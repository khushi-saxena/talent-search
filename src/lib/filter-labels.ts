import type { Filters } from "./filters";

export type Kind =
  | "roles"
  | "seniority"
  | "cities"
  | "skills"
  | "nice_to_have_skills"
  | "companies"
  | "current_companies"
  | "schools"
  | "degrees"
  | "fields"
  | "open_to_work"
  | "years"
  | "worked_at_company_type"
  | "current_company_type";

export const KINDS: { kind: Kind; label: string }[] = [
  { kind: "roles", label: "Role" },
  { kind: "seniority", label: "Seniority" },
  { kind: "cities", label: "Location" },
  { kind: "skills", label: "Skills" },
  { kind: "nice_to_have_skills", label: "Nice-to-have skills" },
  { kind: "years", label: "Years of experience" },
  { kind: "open_to_work", label: "Open to work" },
  { kind: "worked_at_company_type", label: "Has worked at" },
  { kind: "current_company_type", label: "Works at now" },
  { kind: "companies", label: "Past or current company" },
  { kind: "current_companies", label: "Current company" },
  { kind: "schools", label: "School" },
  { kind: "degrees", label: "Degree" },
  { kind: "fields", label: "Field of study" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const article = (t: string) => (/^[aeiou]/i.test(t) ? `an ${t}` : `a ${t}`);

export type Chip = { kind: Kind; value?: string; label: string };

// One chip per value, phrased the way a recruiter would say it.
export function chipsFor(f: Filters): Chip[] {
  const chips: Chip[] = [];
  const each = (kind: Kind, vals: string[], fmt: (v: string) => string) =>
    vals.forEach((v) => chips.push({ kind, value: v, label: fmt(v) }));

  each("seniority", f.seniority, cap);
  each("roles", f.roles, (v) => v);
  each("skills", f.skills, (v) => v);
  each("nice_to_have_skills", f.nice_to_have_skills, (v) => `${v}, ideally`);
  each("cities", f.cities, (v) => `In ${v}`);
  if (f.min_years !== null || f.max_years !== null) {
    const lo = f.min_years;
    const hi = f.max_years;
    const label =
      lo !== null && hi !== null
        ? lo === hi
          ? `${lo} years' experience`
          : `${lo}–${hi} years' experience`
        : lo !== null
          ? `${lo}+ years' experience`
          : `Up to ${hi} years' experience`;
    chips.push({ kind: "years", label });
  }
  if (f.open_to_work !== null) chips.push({ kind: "open_to_work", label: f.open_to_work ? "Open to work" : "Not open to work" });
  if (f.worked_at_company_type) chips.push({ kind: "worked_at_company_type", label: `Has worked at ${article(f.worked_at_company_type)}` });
  if (f.current_company_type) chips.push({ kind: "current_company_type", label: `Works at ${article(f.current_company_type)} now` });
  each("companies", f.companies, (v) => `Has worked at ${v}`);
  each("current_companies", f.current_companies, (v) => `Works at ${v} now`);
  each("degrees", f.degrees, (v) => `Has ${article(v)}`);
  each("fields", f.fields, (v) => `Studied ${v}`);
  each("schools", f.schools, (v) => `Went to ${v}`);
  return chips;
}

export function removeChip(f: Filters, chip: Chip): Filters {
  const next = structuredClone(f);
  if (chip.kind === "years") {
    next.min_years = null;
    next.max_years = null;
  } else if (chip.kind === "open_to_work") next.open_to_work = null;
  else if (chip.kind === "worked_at_company_type" || chip.kind === "current_company_type") next[chip.kind] = null;
  else next[chip.kind] = next[chip.kind].filter((v) => v !== chip.value);
  return next;
}
