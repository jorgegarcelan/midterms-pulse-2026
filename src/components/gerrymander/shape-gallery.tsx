"use client";

import { useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { SHAPE_BOX } from "@/lib/gerrymander";
import type { DistrictShape } from "@/lib/gerrymander-geo";

// Real 2024-map districts drawing themselves, each against the circle of the same area.
export function ShapeGallery({ shapes }: { shapes: DistrictShape[] }) {
  const t = useT();
  const intl = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -20% 0px" });
  const [circles, setCircles] = useState(true);

  return (
    <div className="gm-shapes-wrap" ref={ref} data-in={inView ? "" : undefined}>
      <div className="viz-toolbar">
        <span>{t("119th Congress districts, as used in the 2024 election")}</span>
        <label className="gm-toggle"><input type="checkbox" checked={circles} onChange={(event) => setCircles(event.target.checked)} /> {t("Circle of the same area")}</label>
      </div>
      <div className="gm-shapes">
        {shapes.map((shape, i) => (
          <figure key={shape.id} className="gm-shape" style={{ "--i": i } as React.CSSProperties}>
            <svg viewBox={`0 0 ${SHAPE_BOX} ${SHAPE_BOX}`} role="img" aria-label={t("Outline of {code}", { code: shape.code })}>
              <circle className="gm-shape-circle" data-on={circles ? "" : undefined} cx={shape.circle.cx} cy={shape.circle.cy} r={shape.circle.r} />
              <path className="gm-shape-fill" d={shape.d} />
              <path className="gm-shape-line" d={shape.d} pathLength={1} />
            </svg>
            <figcaption>
              <strong>{shape.code}</strong>
              <span>{t(shape.place)}</span>
              <div className="gm-pp">
                <i style={{ "--pp": shape.score } as React.CSSProperties} />
                <em>{shape.score.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
              </div>
              <small>{shape.rank > shape.of / 2 ? t("#{rank} most compact of {of}", { rank: shape.of - shape.rank + 1, of: shape.of }) : t("#{rank} least compact of {of}", { rank: shape.rank, of: shape.of })}</small>
              {shape.note && <p>{t(shape.note)}</p>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
