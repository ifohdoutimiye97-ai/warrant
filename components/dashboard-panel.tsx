"use client";

import { DemoControlPanel } from "@/components/demo-control-panel";
import { useDemo } from "@/components/demo-provider";
import {
  PRICE_CHART_MAX,
  PRICE_CHART_MIN,
  PRICE_CHART_REFERENCE,
} from "@/lib/demo-constants";

function statusPillClass(status: string) {
  if (status === "executed" || status === "verified") return "pill-success";
  if (status === "blocked") return "pill-danger";
  if (status === "proposed") return "pill-warning";
  return "pill-neutral";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseRange(range: string): { lower: number; upper: number } {
  const [lowerRaw, upperRaw] = range.split(" - ");
  const lower = Number(lowerRaw?.replace(/,/g, ""));
  const upper = Number(upperRaw?.replace(/,/g, ""));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
    return { lower: PRICE_CHART_MIN + 250, upper: PRICE_CHART_MIN + 440 };
  }
  return { lower, upper };
}

export function DashboardPanel() {
  const { agentStates, maxRebalancesPerDay, position, proofStatus, rebalancesToday } = useDemo();

  // P2-09: derive range bar geometry from the real `position.range` so that
  // executing a rebalance in the terminal actually moves the bar here.
  const range = parseRange(position.range);
  const axisWidth = PRICE_CHART_MAX - PRICE_CHART_MIN;
  const rangeLeftPct = clamp(((range.lower - PRICE_CHART_MIN) / axisWidth) * 100, 0, 100);
  const rangeWidthPct = clamp(((range.upper - range.lower) / axisWidth) * 100, 0, 100 - rangeLeftPct);
  const markerLeftPct = clamp(((PRICE_CHART_REFERENCE - PRICE_CHART_MIN) / axisWidth) * 100, 0, 100);

  const dashboardMetrics = [
    {
      label: "Vault TVL",
      value: position.tvl,
      note: "Demo vault for a single Uniswap pool on X Layer.",
    },
    {
      label: "Active range",
      value: position.range,
      note: "Latest range cleared by the proof gate.",
    },
    {
      label: "Net fees",
      value: position.fees,
      note: "Fees attributable to the current proof history.",
    },
    {
      label: "Daily moves",
      value: `${rebalancesToday} / ${maxRebalancesPerDay}`,
      note: "Owner-declared rebalance budget.",
    },
  ];

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Position Dashboard</span>
        <h1 className="section-title">Single-pool liquidity with proof checkpoints.</h1>
        <p className="hero-copy">
          The dashboard shows what Warrant is doing right now. Every value here is bound to
          a warrant ID that owners and judges can verify on chain.
        </p>

        <div className="stat-grid" style={{ marginTop: 32 }}>
          {dashboardMetrics.map((metric) => (
            <article className="stat-card" key={metric.label}>
              <span className="stat-label">{metric.label}</span>
              <strong className="stat-value">{metric.value}</strong>
              <p className="stat-note">{metric.note}</p>
            </article>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
            gap: 20,
            marginTop: 28,
          }}
          className="dashboard-split"
        >
          <article className="card-glow">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 className="h3" style={{ margin: 0 }}>
                Active range
              </h2>
              <span className="pill pill-cyan">{position.range}</span>
            </div>

            <div
              style={{
                marginTop: 28,
                position: "relative",
                height: 12,
                background: "rgba(255, 255, 255, 0.04)",
                borderRadius: 999,
                overflow: "visible",
              }}
              aria-label={`Active range ${position.range}`}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${rangeLeftPct}%`,
                  width: `${rangeWidthPct}%`,
                  top: 0,
                  bottom: 0,
                  background: "linear-gradient(90deg, var(--brand-cyan), var(--brand-purple))",
                  borderRadius: 999,
                  boxShadow: "0 0 20px rgba(143, 245, 255, 0.4)",
                  transition: "left 280ms ease, width 280ms ease",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${markerLeftPct}%`,
                  top: -3,
                  width: 6,
                  height: 18,
                  background: "var(--text-primary)",
                  borderRadius: 2,
                  transform: "translateX(-50%)",
                }}
                title={`Reference price ${PRICE_CHART_REFERENCE}`}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              <span>{PRICE_CHART_MIN}</span>
              <span>{PRICE_CHART_REFERENCE}</span>
              <span>{PRICE_CHART_MAX}</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 16,
                marginTop: 28,
              }}
            >
              <div>
                <span className="stat-label">Pool</span>
                <strong
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "Space Grotesk",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {position.pool}
                </strong>
              </div>
              <div>
                <span className="stat-label">Vault TVL</span>
                <strong
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "Space Grotesk",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {position.tvl}
                </strong>
              </div>
              <div>
                <span className="stat-label">Net fees</span>
                <strong
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "Space Grotesk",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {position.fees}
                </strong>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: "12px 16px",
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Proof gate</span>
              <span className={`pill ${statusPillClass(proofStatus)}`}>{proofStatus}</span>
            </div>
          </article>

          <article className="card-glow">
            <span className="section-kicker">Agent State</span>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {agentStates.map((agent) => (
                <div
                  key={agent.name}
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: "Space Grotesk",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {agent.name}
                    </h3>
                    <span className="pill pill-neutral">{agent.status}</span>
                  </div>
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {agent.description}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section-card">
        <span className="section-kicker">Execution Panel</span>
        <h2 className="section-title">Drive the next proof-backed move.</h2>
        <DemoControlPanel />
      </section>

      <style>{`
        @media (max-width: 980px) {
          .dashboard-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
