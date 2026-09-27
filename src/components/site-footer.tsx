import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Midterm Pulse 2026 · Transparent election intelligence</span>
      <span><Link href="/how-it-works">How it works</Link> · <Link href="/glossary">Glossary</Link> · <Link href="/methodology">Methodology</Link> · Open-source prototype</span>
    </footer>
  );
}
