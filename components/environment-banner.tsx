"use client";

import { useLiveDeployment } from "@/components/live-deployment-context";

/**
 * Thin banner at the very top of the viewport that tells the user whether
 * they are looking at mock demo data or real on-chain state from a live
 * deployment manifest. Explicit separation is a Phase 1 finding (P2-03) —
 * without this, users cannot tell which numbers are authoritative.
 *
 * Responsive rules:
 *   - Desktop: dot · label · sublabel (full manifest info)
 *   - Narrow (<720px): dot · label (sublabel hidden via .env-banner-sublabel)
 *   - Long sublabel lines (AttestationVerifier addresses) get truncated
 *     with ellipsis rather than forcing horizontal overflow.
 */
export function EnvironmentBanner() {
  const { hasLiveManifest, manifest } = useLiveDeployment();

  const isLive = hasLiveManifest;
  const insecureOnMainnet = isLive && manifest.insecureProofs && manifest.chainId === 196;

  const label = !isLive
    ? "Demo mode · Mock data"
    : insecureOnMainnet
      ? "Warning · Insecure verifier"
      : `Live on ${manifest.network}`;
  const sublabel = !isLive
    ? "No live deployment manifest yet"
    : `chainId ${manifest.chainId}${manifest.verifierBackend ? ` · ${manifest.verifierBackend}` : ""}`;

  const variant = !isLive ? "warning" : insecureOnMainnet ? "danger" : "success";

  return (
    <div
      role="status"
      className={`env-banner env-banner--${variant}`}
      aria-label={`${label} — ${sublabel}`}
    >
      <span className="env-banner-dot" aria-hidden="true" />
      <span className="env-banner-label">{label}</span>
      <span className="env-banner-sublabel">· {sublabel}</span>
    </div>
  );
}
