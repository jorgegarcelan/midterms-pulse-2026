"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { introRemaining, prefersReducedMotion } from "@/components/motion/motion-utils";

const REVEAL = [
  ".panel", ".forecast-card", ".model-control-card", ".market-kpis > *", ".geo-kpis > *", ".workspace-kpis > *",
  ".race-directory-table > a", ".district-race-list > a", ".poll-row", ".market-row",
].join(", ");
const ROWS = ".race-directory-table > a, .district-race-list > a, .poll-row, .market-row";
const SPOTLIGHT = ".panel, .forecast-card, .hemi-card";

function updateScrollProgress() {
  const root = document.documentElement;
  const max = root.scrollHeight - window.innerHeight;
  root.style.setProperty("--scroll", max > 0 ? (window.scrollY / max).toFixed(4) : "0");
}

// Site-wide motion: scroll reveals (with batch stagger), cursor spotlight and the header progress bar.
export function MotionDirector() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main || prefersReducedMotion()) return;
    let batch: HTMLElement[] = [];
    let batchFrame = 0;

    const flush = () => {
      batchFrame = 0;
      const base = introRemaining(0);
      const position = new Map(batch.map((element) => [element, element.getBoundingClientRect()]));
      batch.sort((a, b) => position.get(a)!.top - position.get(b)!.top || position.get(a)!.left - position.get(b)!.left)
        .forEach((element, index) => {
          // Table rows cascade quickly; panels take a slower, heavier beat.
          const step = element.matches(ROWS) ? 28 : 75;
          element.style.setProperty("--rv", `${Math.round(base + Math.min(index, 12) * step)}ms`);
          element.dataset.reveal = "in";
        });
      batch = [];
    };
    const queue = (element: HTMLElement) => {
      batch.push(element);
      if (!batchFrame) batchFrame = requestAnimationFrame(() => requestAnimationFrame(flush));
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        queue(entry.target as HTMLElement);
      }
    }, { rootMargin: "0px 0px -8% 0px" });

    const track = (element: HTMLElement) => {
      if (element.dataset.reveal === "pending") { observer.observe(element); return; }
      if (element.dataset.reveal || element.closest("[data-motion]")) return;
      if (element.parentElement?.closest("[data-reveal]") && !element.matches(ROWS)) return;
      element.dataset.reveal = "pending";
      observer.observe(element);
    };
    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(REVEAL)) track(root);
      root.querySelectorAll<HTMLElement>(REVEAL).forEach(track);
    };

    scan(main);
    const mutations = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => { if (node instanceof HTMLElement) scan(node); });
    });
    mutations.observe(main, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      cancelAnimationFrame(batchFrame);
    };
  }, [pathname]);

  // Marks the app as booted after the first frame, so later mounts know they are client navigations.
  useEffect(() => {
    const frame = requestAnimationFrame(() => { document.documentElement.dataset.booted = "true"; });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let frame = 0;
    let spot: HTMLElement | null = null;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; updateScrollProgress(); });
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(SPOTLIGHT) || null;
      if (spot && spot !== target) delete spot.dataset.spot;
      spot = target;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.dataset.spot = "";
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollProgress);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
