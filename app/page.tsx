import Link from "next/link";
import { flowSteps, heroMetrics, systemRoles } from "@/lib/mock-data";
import { LiveStatsStrip } from "@/components/live-stats-strip";

const features = [
  {
    title: "Warrant gate before every move",
    body: "Capital cannot exit the vault until the verifier clears a warrant bound to the exact execution parameters. No warrant, no rebalance, no exception.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Owner-declared strategy",
    body: "Describe risk, allowed pool, and rebalance budget in plain language. The compiler turns it into machine-readable guardrails that the warrant circuit enforces.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4h16v6H4zM4 14h16v6H4zM8 8h.01M8 18h.01" />
      </svg>
    ),
  },
  {
    title: "Auditable agent trail",
    body: "Scout, Executor and Treasury wallets each leave on-chain breadcrumbs. Every action ties back to a warrant ID and a tx hash that owners can replay.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    title: "One warrant, one execution",
    body: "Each warrant is bound to the exact execution hash the scout committed to. The executor cannot substitute different parameters after the fact — the verifier reverts.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "Onchain OS orchestration",
    body: "The Scout, Executor and Treasury roles run as Onchain OS agents that share state through the registry and the warrant verifier.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </svg>
    ),
  },
  {
    title: "Uniswap Skills as the action layer",
    body: "Add, remove and rebalance operations use Uniswap Skills directly, so judges can trace every liquidity action to a real call under a cleared warrant.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 12h6l2-6 4 12 2-6h2" />
      </svg>
    ),
  },
];

const contracts = [
  {
    name: "StrategyRegistry.sol",
    purpose: "Stores owner-declared constraints and enforces a per-day rebalance budget that resets at UTC midnight.",
  },
  {
    name: "ProofVerifier.sol",
    purpose: "Binds warrants to (strategyId, proposalHash, executionHash) and exposes the single-use consume gate.",
  },
  {
    name: "AttestationVerifier.sol",
    purpose: "ECDSA attestation verifier plugged into ProofVerifier. Accepts warrants signed by the authorized scout key.",
  },
  {
    name: "LiquidityVault.sol",
    purpose: "Holds capital. Recomputes executionHash on-chain from the RebalanceAction struct before consuming a warrant.",
  },
  {
    name: "RewardSplitter.sol",
    purpose: "Access-controlled epoch recorder. Enforces scoutReward + executorReward + treasuryReward ≤ grossFees.",
  },
];

const integrations = [
  { label: "X Layer", note: "Native deployment, chain ID 196" },
  { label: "Onchain OS", note: "Agent orchestration layer" },
  { label: "Uniswap Skills", note: "Liquidity action layer" },
  { label: "OKX Web3 Wallet", note: "Owner authentication" },
];

export default function HomePage() {
  return (
    <>
      {/* HERO ===================================================== */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />

        <div className="shell">
          <div style={{ display: "grid", gap: 28, justifyItems: "center", textAlign: "center" }}>
            <span className="hero-eyebrow">
              <span className="dot" />
              Build X Season 2 · X Layer Arena
            </span>

            <h1 className="h-display" style={{ maxWidth: 920 }}>
              Capital doesn&apos;t move without a{" "}
              <span className="text-gradient">warrant</span>.
            </h1>

            <p className="hero-copy" style={{ fontSize: 18, maxWidth: 680 }}>
              Warrant delegates Uniswap concentrated liquidity on X Layer to AI agents
              without giving them blind authority. Every rebalance must clear a warrant —
              a proof bound to owner-declared policy — before the vault can execute.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <Link className="btn btn-primary btn-lg" href="/terminal">
                Try the Demo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <a className="btn btn-secondary btn-lg" href="#how-it-works">
                How It Works
              </a>
            </div>

            <div
              style={{
                display: "flex",
                gap: 18,
                marginTop: 8,
                color: "var(--text-muted)",
                fontSize: 13,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--status-success)",
                    boxShadow: "0 0 8px var(--status-success)",
                  }}
                />
                Proof gate active
              </span>
              <span>·</span>
              <span>Single pool MVP</span>
              <span>·</span>
              <span>Open-source under MIT</span>
            </div>
          </div>

          {/* Live stats strip — reads from DemoProvider so rebalances you run in
               /terminal or /dashboard are reflected here in real time. */}
          <LiveStatsStrip />
        </div>
      </section>

      {/* PRODUCT INTRO =========================================== */}
      <section style={{ padding: "100px 0" }}>
        <div className="shell">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 64 }}>
            <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
              <span className="eyebrow">The Problem</span>
              <h2 className="h1">
                Autonomous DeFi agents are only useful if owners can verify they stayed inside the rules.
              </h2>
              <p className="hero-copy" style={{ fontSize: 16 }}>
                Most agentic DeFi systems focus on credit, reputation or off-chain attestations.
                Warrant takes a different angle: capital cannot move at all unless a warrant
                proves the rebalance respects the owner-declared policy. The verifier sits
                between the agent and the vault, and every action burns exactly one warrant.
              </p>
            </div>

            <div className="stat-grid">
              {heroMetrics.map((metric) => (
                <article className="stat-card" key={metric.label}>
                  <span className="stat-label">{metric.label}</span>
                  <strong className="stat-value">{metric.value}</strong>
                  <p className="stat-note">{metric.note}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ============================================ */}
      <section id="how-it-works" style={{ padding: "60px 0", scrollMarginTop: "calc(var(--env-banner-height, 0px) + 80px)" }}>
        <div className="shell">
          <div style={{ display: "grid", gap: 18, marginBottom: 56, maxWidth: 760 }}>
            <span className="eyebrow">How It Works</span>
            <h2 className="h1">Five steps from owner intent to settled liquidity.</h2>
            <p className="hero-copy" style={{ fontSize: 16 }}>
              The whole loop is designed to be inspectable. Every step writes a record that
              judges, owners and downstream agents can verify independently.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0 }}>
            {flowSteps.map((step) => (
              <div className="flow-line" key={step.step}>
                <span className="flow-index">{step.step}</span>
                <h3 className="h3" style={{ marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 720 }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENT ROLES ============================================= */}
      <section style={{ padding: "100px 0" }}>
        <div className="shell">
          <div style={{ display: "grid", gap: 18, marginBottom: 48, maxWidth: 760 }}>
            <span className="eyebrow">The Agents</span>
            <h2 className="h1">Three agents. One warrant contract.</h2>
            <p className="hero-copy" style={{ fontSize: 16 }}>
              The agent set is intentionally small. Each role has a single responsibility, and
              the warrant verifier is the only thing that authorizes the vault to move capital.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {systemRoles.map((role, index) => (
              <article className="card-glow" key={role.name}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 18,
                  }}
                >
                  <span className="pill pill-cyan">Agent {index + 1}</span>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    0x{(0xa + index).toString(16)}…F4d{index}
                  </span>
                </div>
                <h3 className="h3" style={{ marginBottom: 6 }}>
                  {role.name}
                </h3>
                <p style={{ color: "var(--brand-cyan)", fontSize: 12, fontFamily: "Space Grotesk", marginBottom: 14, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {role.tag}
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                  {role.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE GRID ============================================ */}
      <section style={{ padding: "60px 0 100px" }}>
        <div className="shell">
          <div style={{ display: "grid", gap: 18, marginBottom: 48, maxWidth: 760 }}>
            <span className="eyebrow">What Ships</span>
            <h2 className="h1">Engineered for verifiable execution, not vibes.</h2>
            <p className="hero-copy" style={{ fontSize: 16 }}>
              Warrant is not a thought experiment. The MVP ships with a working terminal,
              proof gate, dashboard, and submission packet ready for X Layer Build judges.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {features.map((feature) => (
              <article className="card" key={feature.title}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(143, 245, 255, 0.08)",
                    border: "1px solid rgba(143, 245, 255, 0.25)",
                    color: "var(--brand-cyan)",
                    marginBottom: 18,
                  }}
                >
                  {feature.icon}
                </div>
                <h3 className="h3" style={{ marginBottom: 8 }}>
                  {feature.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CONTRACT SURFACE ======================================== */}
      <section style={{ padding: "60px 0 100px" }}>
        <div className="shell">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 36,
            }}
          >
            <div className="section-card">
              <span className="section-kicker">Contract Surface</span>
              <h2 className="section-title">Five contracts. Zero magic.</h2>
              <p className="hero-copy" style={{ fontSize: 15, marginBottom: 28 }}>
                The on-chain footprint is intentionally small. Each contract has a single,
                inspectable job, and they together enforce the proof-gate primitive.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                }}
              >
                {contracts.map((contract) => (
                  <div
                    key={contract.name}
                    style={{
                      background: "var(--surface-3)",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 13,
                        color: "var(--brand-cyan)",
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      {contract.name}
                    </span>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
                      {contract.purpose}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS / CTA ====================================== */}
      <section style={{ padding: "60px 0 120px" }}>
        <div className="shell">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 24,
            }}
            className="cta-grid"
          >
            <div className="section-card" style={{ position: "relative", overflow: "hidden" }}>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse 600px 300px at 100% 0%, rgba(143, 245, 255, 0.12), transparent 60%)",
                  pointerEvents: "none",
                }}
              />
              <span className="section-kicker">No warrant, no move.</span>
              <h2 className="section-title">Drive the warrant gate from a real terminal.</h2>
              <p className="hero-copy" style={{ fontSize: 15, marginBottom: 28 }}>
                Spin up the terminal, declare a strategy in natural language, watch the Scout
                generate a proposal, and clear the warrant before the Executor ever touches the vault.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link className="btn btn-primary" href="/terminal">
                  Open Terminal
                </Link>
                <Link className="btn btn-secondary" href="/dashboard">
                  See Live Dashboard
                </Link>
                <a
                  className="btn btn-ghost"
                  href="https://x.com/warrant_fi"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Follow on X
                </a>
              </div>
            </div>

            <div className="section-card">
              <span className="section-kicker">Stack</span>
              <h3 className="h3" style={{ marginTop: 12, marginBottom: 18 }}>
                Native to X Layer.
              </h3>
              <div style={{ display: "grid", gap: 10 }}>
                {integrations.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "var(--surface-3)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                    }}
                  >
                    <strong style={{ fontFamily: "Space Grotesk", fontSize: 13 }}>
                      {item.label}
                    </strong>
                    <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{item.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
