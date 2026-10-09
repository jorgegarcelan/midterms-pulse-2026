"use client";

import { useT } from "@/components/i18n/locale-provider";
import { SenateBuilder } from "@/components/senate/senate-builder";
import { StreamStage, useStreamModel } from "@/components/stream/stream-stage";

// The interactive Senate builder on the broadcast canvas: call states live on stream.
export function StreamSenate({ transparent }: { transparent: boolean }) {
  const t = useT();
  const model = useStreamModel();
  const races = model?.races.filter((race) => race.chamber === "senate") || [];
  return <StreamStage transparent={transparent} model={model}>
    {model ? <div className="stream-senate"><SenateBuilder races={races} /></div> : <p className="stream-loading">{t("Loading model…")}</p>}
  </StreamStage>;
}
