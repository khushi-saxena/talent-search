"use client";
import { MapPin } from "lucide-react";
import type { Card } from "@/lib/client-api";
import { useApp } from "./app-context";
import { ShortlistButton } from "./shortlist-button";
import { Avatar, Logo } from "./ui";

export function PersonRow({ person, highlight = [], action }: { person: Card; highlight?: string[]; action?: React.ReactNode }) {
  const { openPerson } = useApp();
  const skills = [...person.skills].sort((a, b) => Number(highlight.includes(b)) - Number(highlight.includes(a)));

  return (
    <li
      className="group flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-paper/60 md:items-center md:gap-4"
      onClick={() => openPerson(person.id)}
    >
      <Avatar src={person.avatar_url} name={person.full_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button className="text-left text-[15px] font-semibold hover:underline" onClick={() => openPerson(person.id)}>
            {person.full_name}
          </button>
          {person.open_to_work && <span className="rounded-full bg-go-soft px-2 py-px text-[11px] font-semibold text-go">Open to work</span>}
        </div>
        <p className="mt-0.5 text-sm text-muted md:flex md:items-center md:gap-1.5">
          <span className="block md:inline md:truncate">{person.current_title}</span>
          {person.current_company && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="hidden text-faint md:inline">at</span>
              <Logo src={person.current_company_logo_url} />
              <span className="truncate text-ink">{person.current_company}</span>
            </span>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-faint" aria-hidden />
            {person.location.city}
          </span>
          <span>{person.years_experience === 1 ? "1 year" : `${person.years_experience} years`}</span>
          <span className="hidden flex-wrap gap-1 sm:flex">
            {skills.slice(0, 5).map((s) => (
              <span key={s} className={`rounded px-1.5 py-px text-[12px] ${highlight.includes(s) ? "bg-marker-soft text-marker-ink" : "bg-paper text-muted"}`}>
                {s}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action ?? (
<ShortlistButton personId={person.id} />
        )}
      </div>
    </li>
  );
}
