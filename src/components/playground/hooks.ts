"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DemographicsFile } from "@/lib/playground/scenario";

// One fetch per page view, shared by every tool.
const cached = new Map<string, Promise<unknown>>();
export function fetchOnce<T>(url: string, parse: (response: Response) => Promise<T> = (response) => response.json() as Promise<T>) {
  if (!cached.has(url)) {
    cached.set(url, fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      return parse(response);
    }).catch((error) => { cached.delete(url); throw error; }));
  }
  return cached.get(url) as Promise<T>;
}

export function useResource<T>(load: () => Promise<T>, enabled = true) {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  const loader = useRef(load);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loader.current().then((data) => { if (alive) setState({ data, error: false }); }).catch(() => { if (alive) setState({ data: null, error: true }); });
    return () => { alive = false; };
  }, [enabled]);
  return state;
}

export const useDemographics = () => useResource(() => fetchOnce<DemographicsFile>("/data/demographics.json"));

const motionQuery = "(prefers-reduced-motion: reduce)";
export function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => { const query = window.matchMedia(motionQuery); query.addEventListener("change", notify); return () => query.removeEventListener("change", notify); },
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

// Width of an element, tracked with ResizeObserver (0 while hidden).
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const area = document.createElement("textarea");
    area.value = text; document.body.append(area); area.select();
    const ok = document.execCommand("copy"); area.remove(); return ok;
  }
}
