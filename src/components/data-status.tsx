"use client";

import { useEffect, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

export type DataStatus = { benchmarkDate: string; ageDays: number; stale: boolean; bundledSnapshot: boolean };

let pending: Promise<DataStatus | null> | null = null;
// One request per page view, shared by the header, the banner and the footer.
export function useDataStatus() {
  const [status, setStatus] = useState<DataStatus | null>(null);
  useEffect(() => {
    let alive = true;
    pending ??= fetch("/api/status").then((response) => response.ok ? response.json() as Promise<DataStatus> : null).catch(() => null);
    pending.then((value) => { if (alive) setStatus(value); });
    return () => { alive = false; };
  }, []);
  return status;
}

export function useDataDate(status: DataStatus | null) {
  const intl = useIntlLocale();
  return status ? new Date(`${status.benchmarkDate}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) : "";
}

// Shown under the header only when the data is behind, so stale numbers are never presented as current.
export function StaleBanner() {
  const t = useT();
  const status = useDataStatus();
  const date = useDataDate(status);
  if (!status?.stale) return null;
  return <div className="stale-banner" role="status"><i aria-hidden="true" />{t("Forecast and polling data are from {date}: the latest update has not arrived yet.", { date })}</div>;
}
