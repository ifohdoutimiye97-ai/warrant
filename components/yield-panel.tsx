"use client";

import { useDemo } from "@/components/demo-provider";

export function YieldPanel() {
  const { yieldRecords } = useDemo();

  const totalPnl = yieldRecords.reduce((sum, record) => {
    const value = Number(record.pnl.replace(/[$,+]/g, ""));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const verifiedCount = yieldRecords.filter((record) =>
    record.event.toLowerCase().includes("rebalance"),
  ).length;

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Yield History</span>
        <h1 className="section-title">Profit, proof ID and vault behavior stay tied together.</h1>
        <p className="hero-copy">
          Every yield record links back to the proof that authorized the underlying rebalance.
          Judges can reconstruct why each fee was earned, not just how much.
        </p>

        <div
          className="stat-grid"
          style={{ marginTop: 32, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <article className="stat-card">
            <span className="stat-label">Cumulative PnL</span>
            <strong className="stat-value text-gradient-cyan">
              +${totalPnl.toFixed(2)}
            </strong>
            <p className="stat-note">Demo vault over the current session.</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Verified rebalances</span>
            <strong className="stat-value">{verifiedCount}</strong>
            <p className="stat-note">Every move was cleared by the proof gate.</p>
          </article>
          <article className="stat-card">
            <span className="stat-label">Events recorded</span>
            <strong className="stat-value">{yieldRecords.length}</strong>
            <p className="stat-note">Including held positions and bootstrap.</p>
          </article>
        </div>

        {/* Sparkline-style chart */}
        <div
          style={{
            marginTop: 28,
            padding: 28,
            background:
              "linear-gradient(180deg, rgba(143, 245, 255, 0.04), transparent 70%), var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2 className="h3" style={{ margin: 0 }}>
              Cumulative yield curve
            </h2>
            <span className="pill pill-cyan">Demo</span>
          </div>
          <svg viewBox="0 0 600 160" style={{ width: "100%", height: 160 }}>
            <defs>
              <linearGradient id="yieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8ff5ff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8ff5ff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="yieldLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8ff5ff" />
                <stop offset="100%" stopColor="#c47fff" />
              </linearGradient>
            </defs>
            <path
              d="M 0 140 L 100 120 L 200 90 L 300 95 L 400 60 L 500 45 L 600 20 L 600 160 L 0 160 Z"
              fill="url(#yieldGradient)"
            />
            <path
              d="M 0 140 L 100 120 L 200 90 L 300 95 L 400 60 L 500 45 L 600 20"
              fill="none"
              stroke="url(#yieldLine)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          {yieldRecords.map((record) => (
            <div
              key={record.id}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: "18px 22px",
                display: "grid",
                gridTemplateColumns: "minmax(80px, auto) 1fr auto auto",
                gap: 20,
                alignItems: "center",
              }}
              className="yield-row"
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.02em",
                }}
              >
                {record.date}
              </span>
              <strong
                style={{
                  fontFamily: "Space Grotesk",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {record.event}
              </strong>
              <span
                style={{
                  fontFamily: "Space Grotesk",
                  fontSize: 15,
                  fontWeight: 600,
                  color: record.pnl.startsWith("+$")
                    ? "var(--status-success)"
                    : "var(--text-primary)",
                }}
              >
                {record.pnl}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: "var(--brand-cyan)",
                  whiteSpace: "nowrap",
                }}
              >
                {record.proof}
              </span>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 780px) {
          .yield-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
