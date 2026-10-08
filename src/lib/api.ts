import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { userClient } from "./supabase/server";

export type Ctx = { db: SupabaseClient; userId: string };

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const fail = (status: number, error: string) => json({ error }, status);

// Verifies the bearer token and returns a client scoped to that recruiter.
export async function auth(req: Request): Promise<Ctx | Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return fail(401, "Missing bearer token");

  const db = userClient(token);
  const { data, error } = await db.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || !sub || data.claims.role !== "authenticated") return fail(401, "Invalid or expired token");
  return { db, userId: sub };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as T) : null;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export function dbError(e: { code?: string; message?: string } | null) {
  if (!e) return fail(500, "Something went wrong");
  if (e.code === "42501") return fail(403, "Not allowed");
  if (e.code === "23503") return fail(404, "Not found");
  if (e.code === "23514" || e.code === "22P02") return fail(400, "Invalid input");
  console.error(e);
  return fail(500, "Something went wrong");
}
