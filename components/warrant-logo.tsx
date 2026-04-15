/**
 * Warrant logo — the canonical brand mark.
 *
 * Geometry: pointy-top hexagonal seal (the "warrant stamp") with a
 * bold chevron-W glyph inside. A small cyan node at the middle peak
 * marks the "seal anchor" — the point where the scout's warrant is
 * bound to a specific execution hash.
 *
 * Color system matches the rest of the app:
 *   #8ff5ff (cyan)   →   #c47fff (purple)   gradient
 *
 * Designed to work at every scale:
 *   16px   favicon
 *   36px   header / footer brand mark
 *   80px+  hero anchor
 *
 * Implementation notes:
 *   - Gradient IDs are namespaced with the `instance` prop so multiple
 *     copies of the logo on one page don't alias each other's gradients.
 *     Default `instance="default"` works for single-logo pages.
 *   - Returns inline SVG, zero dependencies, SSR-safe (no hooks).
 */

type WarrantLogoProps = {
  size?: number;
  title?: string;
  /**
   * Unique suffix so each logo instance gets its own gradient ids.
   * Supply "header", "footer", "hero", etc. when rendering multiple
   * logos on the same page.
   */
  instance?: string;
  className?: string;
};

export function WarrantLogo({
  size = 36,
  title = "Warrant",
  instance = "default",
  className,
}: WarrantLogoProps) {
  const strokeId = `wr-stroke-${instance}`;
  const edgeId = `wr-edge-${instance}`;
  const fillId = `wr-fill-${instance}`;
  const glowId = `wr-glow-${instance}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <defs>
        {/* Main glyph gradient — cyan → purple */}
        <linearGradient id={strokeId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8ff5ff" />
          <stop offset="55%" stopColor="#8ff5ff" />
          <stop offset="100%" stopColor="#c47fff" />
        </linearGradient>

        {/* Hexagon edge gradient — same hues but semi-transparent so the
            seal glows against the dark background */}
        <linearGradient id={edgeId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8ff5ff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#8ff5ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c47fff" stopOpacity="0.5" />
        </linearGradient>

        {/* Hexagon fill — near-black with a slight radial lift */}
        <radialGradient id={fillId} cx="30%" cy="25%" r="95%">
          <stop offset="0%" stopColor="#13131f" />
          <stop offset="70%" stopColor="#070710" />
          <stop offset="100%" stopColor="#050509" />
        </radialGradient>

        {/* Inner glow overlay — cyan halo fading to nothing */}
        <radialGradient id={glowId} cx="30%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#8ff5ff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#8ff5ff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Hexagon seal (pointy-top, regular, radius 22, center 24,24) */}
      <path
        d="M24 2 L43 13 L43 35 L24 46 L5 35 L5 13 Z"
        fill={`url(#${fillId})`}
        stroke={`url(#${edgeId})`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Inner glow overlay layered on top of the seal fill */}
      <path
        d="M24 2 L43 13 L43 35 L24 46 L5 35 L5 13 Z"
        fill={`url(#${glowId})`}
        pointerEvents="none"
      />

      {/* W glyph — 5-vertex chevron stroke.
          Start top-left, drop to bottom-left valley, climb to middle
          peak, drop to bottom-right valley, climb to top-right. */}
      <path
        d="M13 15 L19 34 L24 22 L29 34 L35 15"
        stroke={`url(#${strokeId})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Warrant seal anchor — a cyan node at the middle peak of the
          W, symbolically the point where the scout's warrant binds to
          an execution hash. */}
      <circle cx="24" cy="22" r="1.6" fill="#8ff5ff" />
      <circle cx="24" cy="22" r="3.2" fill="#8ff5ff" fillOpacity="0.18" />
    </svg>
  );
}
