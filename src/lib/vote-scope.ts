/*
  Vote-Scope's public JSON sits behind Cloudflare, which refuses many datacenter IPs (Vercel's among
  them). Every read tries the source first and falls back to a mirror that the "Mirror Vote-Scope"
  GitHub Action refreshes every 30 minutes on the data-mirror branch. Callers keep their own last-resort
  fallback (the snapshot bundled with the site) for when both are unreachable.
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
