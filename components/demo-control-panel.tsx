"use client";

import { useDemo } from "@/components/demo-provider";

function statusPillClass(status: string) {
  if (status === "verified" || status === "executed") return "pill-success";
  if (status === "blocked") return "pill-danger";
  if (status === "proposed") return "pill-warning";
  return "pill-neutral";
}

function statusLabel(status: string) {
  return status.replace(/^\w/, (char) => char.toUpperCase());
}

export function DemoControlPanel() {
  const {
    currentProofId,
    executeRebalance,
    generateStrategy,
    isBusy,
    maxRebalancesPerDay,
    proofStatus,
    rebalancesToday,
    resetDemo,
    runScoutProposal,
    simulateBlockedMove,
    verifyProof,
  } = useDemo();

  return (
    <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
        className="control-stats"
      >
        <div
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
            <span className="stat-label">Proof status</span>
            <span className={`pill ${statusPillClass(proofStatus)}`}>
              {statusLabel(proofStatus)}
            </span>
          </div>
        </div>
        <div
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <span className="stat-label">Current proof</span>
          <strong
            className="font-mono"
            style={{
              display: "block",
              marginTop: 6,
              fontSize: 12,
              color: "var(--brand-cyan)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentProofId}
          </strong>
        </div>
        <div
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <span className="stat-label">Daily usage</span>
          <strong
            style={{
              display: "block",
              marginTop: 6,
              fontFamily: "Space Grotesk",
              fontSize: 16,
              color: "var(--text-primary)",
            }}
          >
            {rebalancesToday} / {maxRebalancesPerDay}
          </strong>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => generateStrategy()}
          disabled={isBusy}
        >
          <span style={{ opacity: 0.7, marginRight: 4 }}>01</span> Compile strategy
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={runScoutProposal}
          disabled={isBusy}
        >
          <span style={{ opacity: 0.6, marginRight: 4 }}>02</span> Scout proposal
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={verifyProof}
          disabled={isBusy}
        >
          <span style={{ opacity: 0.6, marginRight: 4 }}>03</span> Verify proof
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={executeRebalance}
          disabled={isBusy}
        >
          <span style={{ opacity: 0.6, marginRight: 4 }}>04</span> Execute rebalance
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={simulateBlockedMove}
          disabled={isBusy}
        >
          Simulate block
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={resetDemo}
          disabled={isBusy}
        >
          Reset demo
        </button>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .control-stats {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
