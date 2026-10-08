"use client";
import type { Filters } from "./filters";
import { browserClient } from "./supabase/browser";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const sb = browserClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.assign("/login");
    throw new ApiError(401, "Signed out");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach Rotto. Check your connection and try again.");
  }

  const json = await res.json().catch(() => null);
  if (res.status === 401) {
    await sb.auth.signOut();
    window.location.assign("/login");
  }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? "Something went wrong. Try again.");
  return json as T;
}

export type Card = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_logo_url: string | null;
  role: string;
  seniority: string;
  years_experience: number;
  location: { city: string | null; state: string | null; country: string | null };
  open_to_work: boolean;
  skills: string[];
};

export type Person = Card & {
  experiences: {
    title: string;
    company: string;
    company_logo_url: string | null;
    company_type: string;
    start_year: number;
    end_year: number | null;
    description: string | null;
  }[];
  education: { school: string; degree: string; field: string; graduation_year: number | null }[];
};

export type SearchResponse = {
  search_id: string;
  filters: Filters;
  total: number;
  results: Card[];
  searches_remaining: number | null;
  note: string | null;
};

export type PageResponse = {
  search_id: string;
  brief: string;
  filters: Filters;
  total: number;
  page: number;
  results: Card[];
};

export type Plan = { plan: "free" | "paid"; searches_remaining: number | null };
export type Shortlist = { id: string; name: string; created_at: string; person_ids: string[] };
export type SavedBrief = { id: string; brief: string; filters: Filters; created_at: string };
