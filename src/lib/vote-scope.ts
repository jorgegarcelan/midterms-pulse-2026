/*
  Vote-Scope's public JSON sits behind Cloudflare, which refuses many datacenter IPs (Vercel's among
  them, and GitHub's and cloud runners'). Every read tries the source first and falls back to a mirror
  on the data-mirror branch, refreshed from a normal connection with `npm run data:mirror` (a daily
  task in the Claude app runs it). Callers keep their own last-resort fallback (the snapshot bundled
  with the site); /api/status reports how old the data is so the site can say so.
*/
const SOURCE = "https://vote-scope.com/web_data";
const MIRROR = process.env.VOTE_SCOPE_MIRROR_URL || "https://raw.githubusercontent.com/jorgegarcelan/midterms-pulse-2026/data-mirror/vote-scope";

export type VoteScopeFile = "us-house/latest.json" | "us-senate/latest.json" | "us-house/polls/index.json" | "us-senate/polls/index.json";

async function read<T>(url: string, revalidate: number, timeout: number) {
  const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  // A Cloudflare challenge answers 200 with HTML, so a failed parse also means "blocked".
  return await response.json() as T;
}

export async function fetchVoteScope<T>(file: VoteScopeFile, revalidate = 900): Promise<T> {
  try {
    return await read<T>(`${SOURCE}/${file}`, revalidate, 6000);
  } catch {
    return read<T>(`${MIRROR}/${file}`, revalidate, 8000);
  }
}
