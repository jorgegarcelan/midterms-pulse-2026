import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "redis";
import type { NightDoc } from "@/lib/night";

/*
  Where the night's calls live. On Vercel: Redis, either through REDIS_URL (the Redis Marketplace
  integration) or Upstash's REST API (KV_REST_API_URL / KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_*).
  Locally, without those variables: a JSON file in work/ (gitignored), so a rehearsal runs on a laptop
  with no setup. On Vercel without Redis, writes fail loudly rather than vanish between instances.
*/

export type NightSlot = "live" | "rehearsal";
const KEYS: Record<NightSlot, string> = { live: "night:2026:live", rehearsal: "night:2026:rehearsal" };
// A rehearsal deletes itself after twelve hours, so a forgotten one can never linger into the real night.
const REHEARSAL_TTL = 12 * 3600;

const TCP_URL = process.env.REDIS_URL;
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_FILE = join(process.cwd(), "work", "night-store.json");

export const storeKind = TCP_URL || (REST_URL && REST_TOKEN) ? "redis" : process.env.VERCEL ? "none" : "file";

// One connection per server instance, reused across requests; dropped on error so the next request reconnects.
const connect = () => createClient({ url: TCP_URL, socket: { connectTimeout: 5000, reconnectStrategy: false } });
let tcp: Promise<ReturnType<typeof connect>> | null = null;
function tcpClient() {
  tcp ??= (async () => {
    const client = connect();
    client.on("error", () => { tcp = null; });
    await client.connect();
    return client;
  })().catch((error) => { tcp = null; throw error; });
  return tcp;
}

async function rest<T>(command: (string | number)[]): Promise<T> {
  const response = await fetch(REST_URL!, {
    method: "POST", headers: { Authorization: `Bearer ${REST_TOKEN}` }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Redis ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

const redis = {
  async get(key: string) { return TCP_URL ? (await tcpClient()).get(key) : rest<string | null>(["GET", key]); },
  async set(key: string, value: string, ttl?: number) {
    if (TCP_URL) await (await tcpClient()).set(key, value, ttl ? { expiration: { type: "EX", value: ttl } } : undefined);
    else await rest(ttl ? ["SET", key, value, "EX", ttl] : ["SET", key, value]);
  },
  async del(key: string) { if (TCP_URL) await (await tcpClient()).del(key); else await rest(["DEL", key]); },
};

async function readLocal(): Promise<Partial<Record<NightSlot, NightDoc>>> {
  try { return JSON.parse(await readFile(LOCAL_FILE, "utf8")); } catch { return {}; }
}

export async function loadNight(slot: NightSlot): Promise<NightDoc | null> {
  if (storeKind === "redis") {
    const raw = await redis.get(KEYS[slot]);
    return raw ? JSON.parse(raw) as NightDoc : null;
  }
  if (storeKind === "file") return (await readLocal())[slot] ?? null;
  return null;
}

export async function saveNight(slot: NightSlot, doc: NightDoc | null) {
  if (storeKind === "none") throw new Error("No results store: connect a Redis database to the Vercel project.");
  if (storeKind === "redis") {
    if (!doc) await redis.del(KEYS[slot]);
    else await redis.set(KEYS[slot], JSON.stringify(doc), slot === "rehearsal" ? REHEARSAL_TTL : undefined);
    return;
  }
  const all = await readLocal();
  if (doc) all[slot] = doc; else delete all[slot];
  await mkdir(join(process.cwd(), "work"), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(all));
}
