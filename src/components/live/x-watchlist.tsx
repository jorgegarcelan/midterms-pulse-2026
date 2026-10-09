"use client";

import Script from "next/script";
import { FormEvent, useEffect, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";

const STORAGE_KEY = "midterm-pulse-x-accounts";
const DEFAULT_ACCOUNTS = ["CookPolitical", "DecisionDeskHQ", "Redistrict"];

declare global {
  interface Window { twttr?: { widgets?: { load: (element?: HTMLElement) => void } } }
}

function cleanHandle(value: string) {
  return value.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15);
}

// Optional X timelines. Embeds are often blocked (no X session, strict privacy settings), so this is a
// secondary tool: every account always has a direct profile link, and the widget loads only on request.
export function XWatchlist() {
  const t = useT();
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [active, setActive] = useState(DEFAULT_ACCOUNTS[0]);
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let timer = 0;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) timer = window.setTimeout(() => { setAccounts(parsed); setActive(parsed[0] || ""); }, 0);
    } catch { /* browser storage is optional */ }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!requested || !ready || !active) return;
    const timer = window.setTimeout(() => window.twttr?.widgets?.load(document.querySelector(".x-timeline") as HTMLElement), 100);
    return () => window.clearTimeout(timer);
  }, [active, requested, ready]);

  function save(next: string[], preferred = active) {
    setAccounts(next);
    setActive(next.includes(preferred) ? preferred : next[0] || "");
    setRequested(false);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = cleanHandle(String(new FormData(event.currentTarget).get("handle") || ""));
    if (handle && !accounts.some((item) => item.toLowerCase() === handle.toLowerCase())) save([...accounts, handle], handle);
    event.currentTarget.reset();
  }

  return (
    <details className="panel live-tool x-watchlist">
      <summary><span><b>{t("X watchlist")}</b><small>{t("{count} accounts · embeds load on request", { count: accounts.length })}</small></span><i aria-hidden="true">+</i></summary>
      {requested && <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onLoad={() => setReady(true)} onReady={() => setReady(true)} onError={() => setFailed(true)} />}
      <form onSubmit={add}><label className="sr-only" htmlFor="x-handle">{t("X account")}</label><input id="x-handle" name="handle" placeholder={t("@handle or profile URL")} /><button type="submit">{t("Add")}</button></form>
      <div className="x-accounts">
        {accounts.map((account) => (
          <span key={account} className={active === account ? "active" : ""}>
            <button type="button" onClick={() => { setActive(account); setRequested(false); setFailed(false); }}>@{account}</button>
            <a href={`https://x.com/${account}`} target="_blank" rel="noreferrer" aria-label={t("Open @{account} on X", { account })}>↗</a>
            <button type="button" aria-label={t("Remove {account}", { account })} onClick={() => save(accounts.filter((item) => item !== account))}>×</button>
          </span>
        ))}
      </div>
      {active && <div className="x-timeline" key={`${active}-${requested}`}>
        {!requested ? <button type="button" className="x-load" onClick={() => { setFailed(false); setReady(Boolean(window.twttr?.widgets)); setRequested(true); }}>{t("Load @{account} timeline", { account: active })}</button>
          : failed ? <p>{t("X's widget could not load.")} <a href={`https://x.com/${active}`} target="_blank" rel="noreferrer">{t("Open @{account} on X", { account: active })} ↗</a></p>
            : <a className="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter transparent" data-height="520" data-dnt="true" href={`https://twitter.com/${active}`}>{t("Loading @{account}… if nothing appears, X is blocking embeds in this browser — open the profile instead.", { account: active })}</a>}
      </div>}
    </details>
  );
}
