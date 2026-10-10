"use client";

import { useEffect, useState } from "react";

// The analyst only appears when the server has a model key; its offline answers are fixed text that ages badly.
export function useAnalystEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analyst", { signal: controller.signal }).then((response) => response.json() as Promise<{ enabled: boolean }>).then((data) => setEnabled(Boolean(data.enabled))).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return enabled;
}
