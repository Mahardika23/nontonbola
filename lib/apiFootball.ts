// Thin server-only client for API-Football (api-sports.io direct, v3).
// The key lives in API_FOOTBALL_KEY (.env.local) and is never sent to the client.
// Only the scheduler calls this; request handlers read the cached results from SQLite.

const BASE = "https://v3.football.api-sports.io";

export function hasApiKey(): boolean {
  return !!process.env.API_FOOTBALL_KEY;
}

export type ApiEnvelope<T> = {
  get: string;
  parameters: Record<string, string>;
  errors: unknown;
  results: number;
  paging?: { current: number; total: number };
  response: T;
};

function hasErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as object).length > 0;
  return false;
}

/**
 * Call an API-Football endpoint and return the `response` payload.
 * Throws on transport errors, non-2xx, or a populated `errors` field
 * (api-sports returns 200 with an `errors` object for quota/auth problems).
 */
export async function apiFootball<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    cache: "no-store", // we cache in SQLite ourselves
  });
  if (!res.ok) {
    throw new Error(`API-Football ${path} -> HTTP ${res.status}`);
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (hasErrors(json.errors)) {
    throw new Error(`API-Football ${path} errors: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}
