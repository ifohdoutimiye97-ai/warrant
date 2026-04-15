import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const footerProduct = [
  { label: "Terminal", href: "/terminal" },
  { label: "Strategy Studio", href: "/strategy" },
  { label: "Position Dashboard", href: "/dashboard" },
  { label: "Proof Center", href: "/proofs" },
];

const footerResources = [
  { label: "Activity Feed", href: "/activity" },
  { label: "Yield History", href: "/yield" },
  { label: "Submission Packet", href: "/submit" },
  { label: "Documentation", href: "https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information", external: true },
];

const footerEcosystem = [
  { label: "X Layer", href: "https://web3.okx.com/xlayer", external: true },
  { label: "Build X Hackathon", href: "https://web3.okx.com/vi/xlayer/build-x-hackathon", external: true },
  { label: "Onchain OS", href: "https://web3.okx.com/zh-hans/onchainos", external: true },
  { label: "Uniswap AI", href: "https://github.com/Uniswap/uniswap-ai", external: true },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-grid">
          <div>
            <BrandMark href="/" instance="footer" />
            <p
              style={{
                marginTop: 20,
                color: "var(--text-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 320,
              }}
            >
              Warrant is a proof-gated liquidity agent system on X Layer. Capital cannot move
              until a warrant clears the verifier.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <a
                className="icon-link"
                href="https://x.com/warrant_fi"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Follow on X"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2H21.5L14.36 10.166 22.75 22h-6.78l-5.31-6.94L4.6 22H1.34l7.64-8.74L.97 2h6.94l4.8 6.34L18.244 2Zm-1.18 18h1.86L7.04 4H5.04l12.024 16Z" />
                </svg>
              </a>
              <a
                className="icon-link"
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="View on GitHub"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.16-.01-2.1-3.2.58-4.03-.78-4.29-1.5-.14-.36-.76-1.5-1.31-1.8-.45-.24-1.09-.84-.02-.85 1.01-.02 1.73.93 1.97 1.31 1.15 1.94 2.99 1.39 3.72 1.07.11-.83.45-1.39.81-1.71-2.84-.32-5.81-1.42-5.81-6.31 0-1.39.5-2.55 1.31-3.45-.13-.32-.57-1.62.13-3.37 0 0 1.07-.34 3.51 1.32a11.84 11.84 0 0 1 6.4 0c2.43-1.66 3.5-1.32 3.5-1.32.7 1.75.26 3.05.13 3.37.81.9 1.31 2.05 1.31 3.45 0 4.91-2.99 6-5.83 6.31.46.4.87 1.17.87 2.36 0 1.71-.02 3.08-.02 3.51 0 .31.21.67.8.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
              <a
                className="icon-link"
                href="https://web3.okx.com/xlayer"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="X Layer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2 1 9l11 7 11-7-11-7Zm0 12L1 21l11 7 11-7-11-7Z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <ul>
              {footerProduct.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h5>Resources</h5>
            <ul>
              {footerResources.map((item) =>
                "external" in item ? (
                  <li key={item.href}>
                    <a href={item.href} target="_blank" rel="noreferrer noopener">
                      {item.label}
                    </a>
                  </li>
                ) : (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="footer-col">
            <h5>Ecosystem</h5>
            <ul>
              {footerEcosystem.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noreferrer noopener">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Warrant Labs. Built for X Layer Build Season 2.</p>
          <p>
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              Chain ID 196
            </span>{" "}
            ·{" "}
            <a
              href="https://www.okx.com/web3/explorer/xlayer"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--text-secondary)" }}
            >
              X Layer Explorer
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
