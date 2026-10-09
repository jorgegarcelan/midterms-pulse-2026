"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";

type ShareImageButtonProps = { href: string; label?: string; className?: string };

// Downloads a server-rendered share card. The card takes a moment to render, so the button shows
// progress; without JavaScript the link still downloads the image.
export function ShareImageButton({ href, label, className = "" }: ShareImageButtonProps) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const url = `${href}${href.includes("?") ? "&" : "?"}download=1`;

  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (state === "busy") return;
    setState("busy");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Share image ${response.status}`);
      const filename = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "midterm-pulse.png";
      const blob = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blob;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(blob), 1000);
      setState("idle");
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <a className={`share-image ${className}`} href={url} download onClick={download} data-state={state} aria-busy={state === "busy"}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 12.8h10" /></svg>
      <span>{state === "busy" ? t("Rendering…") : state === "error" ? t("Try again") : label ?? t("Download image")}</span>
    </a>
  );
}
