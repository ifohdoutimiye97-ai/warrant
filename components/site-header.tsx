"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/components/wallet-context";
import { getNetwork, NETWORKS } from "@/config/networks";

const navLinks = [
  { href: "/terminal", label: "Terminal" },
  { href: "/strategy", label: "Strategy" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/activity", label: "Activity" },
  { href: "/proofs", label: "Proofs" },
  { href: "/yield", label: "Yield" },
];

function NetworkPill() {
  const { status, chainId, isCorrectNetwork, targetChainId, switchNetwork } = useWallet();
  const targetNetwork = NETWORKS[targetChainId];

  if (status !== "connected" || chainId == null) {
    return (
      <span className="network-pill" title={`Target: ${targetNetwork?.name ?? "X Layer"}`}>
        {targetNetwork?.shortName ?? "X Layer"}
      </span>
    );
  }

  if (!isCorrectNetwork) {
    const current = getNetwork(chainId);
    return (
      <button
        type="button"
        className="network-pill"
        style={{
          borderColor: "rgba(255, 113, 108, 0.4)",
          background: "rgba(255, 113, 108, 0.08)",
          color: "var(--status-danger)",
          cursor: "pointer",
        }}
        onClick={() => {
          void switchNetwork();
        }}
        title={`Connected to ${current?.name ?? `chainId ${chainId}`}. Click to switch to ${targetNetwork?.name ?? "X Layer"}.`}
      >
        Wrong network
      </button>
    );
  }

  return (
    <span className="network-pill" title={targetNetwork?.name}>
      {targetNetwork?.shortName ?? "X Layer"}
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close drawer whenever the route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileNavOpen]);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandMark />

        <nav className="nav-links" aria-label="Primary">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${isActive ? " active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-cluster">
          <NetworkPill />
          <a
            className="icon-link nav-desktop-only"
            href="https://x.com/warrant_fi"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Follow Warrant on X"
            title="Follow on X"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2H21.5L14.36 10.166 22.75 22h-6.78l-5.31-6.94L4.6 22H1.34l7.64-8.74L.97 2h6.94l4.8 6.34L18.244 2Zm-1.18 18h1.86L7.04 4H5.04l12.024 16Z" />
            </svg>
          </a>
          <a
            className="icon-link nav-desktop-only"
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source on GitHub"
            title="GitHub"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.16-.01-2.1-3.2.58-4.03-.78-4.29-1.5-.14-.36-.76-1.5-1.31-1.8-.45-.24-1.09-.84-.02-.85 1.01-.02 1.73.93 1.97 1.31 1.15 1.94 2.99 1.39 3.72 1.07.11-.83.45-1.39.81-1.71-2.84-.32-5.81-1.42-5.81-6.31 0-1.39.5-2.55 1.31-3.45-.13-.32-.57-1.62.13-3.37 0 0 1.07-.34 3.51 1.32a11.84 11.84 0 0 1 6.4 0c2.43-1.66 3.5-1.32 3.5-1.32.7 1.75.26 3.05.13 3.37.81.9 1.31 2.05 1.31 3.45 0 4.91-2.99 6-5.83 6.31.46.4.87 1.17.87 2.36 0 1.71-.02 3.08-.02 3.51 0 .31.21.67.8.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
          <WalletButton />
          <button
            type="button"
            className="nav-mobile-toggle"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18l12-12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer — only visible when mobileNavOpen is true AND viewport <= 1100px */}
      <div
        id="mobile-nav-drawer"
        className={`mobile-nav-drawer${mobileNavOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileNavOpen}
      >
        <nav aria-label="Mobile primary">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`mobile-nav-link${isActive ? " active" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mobile-nav-divider" />
          <a
            className="mobile-nav-link"
            href="https://x.com/warrant_fi"
            target="_blank"
            rel="noreferrer noopener"
          >
            Follow on X
          </a>
          <a
            className="mobile-nav-link"
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
