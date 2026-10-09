"use client";

import { useState } from "react";
import { initials, partyTone, portraitUrl, type Candidate } from "@/lib/candidates";
import "./candidates.css";

// Official portrait for sitting members of Congress; everyone else gets party-tinted initials.
export function CandidateAvatar({ candidate, size = "md" }: { candidate: Pick<Candidate, "name" | "party" | "bioguide">; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const photo = candidate.bioguide && !failed;
  return <span className={`cand-avatar ${size} ${partyTone(candidate.party)}`} aria-hidden="true">
    {photo
      // eslint-disable-next-line @next/next/no-img-element -- external public-domain portraits; next/image would need a remote pattern in the shared config.
      ? <img src={portraitUrl(candidate.bioguide as string)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
        // A portrait that failed before hydration never fires onError; catch it when the node mounts.
        ref={(node) => { if (node?.complete && !node.naturalWidth) setFailed(true); }} />
      : <b>{initials(candidate.name)}</b>}
  </span>;
}
