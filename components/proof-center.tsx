"use client";

import { DemoControlPanel } from "@/components/demo-control-panel";
import { useDemo } from "@/components/demo-provider";

function statusPillClass(status: string) {
  if (status === "verified" || status === "executed") return "pill-success";
  if (status === "blocked") return "pill-danger";
  if (status === "proposed") return "pill-warning";
  return "pill-neutral";
}

export function ProofCenter() {
  const { currentProofId, proofChecks, proofStatus, verifyProof, isBusy } = useDemo();

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Proof Center</span>
        <h1 className="section-title">Capital only moves when the proof says the rules were followed.</h1>
        <p className="hero-copy">
          The proof verifier binds every rebalance proposal to an owner-declared policy. Inspect
          the witness, verify the submission, then let the executor touch the vault.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
            gap: 24,
            marginTop: 32,
          }}
          className="proof-layout-grid"
        >
          <div className="card-glow">
            <label
              htmlFor="proof"
              style={{
                display: "block",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: 12,
              }}
            >
              Current proof ID
            </label>
            <input
              id="proof"
              className="input font-mono"
              value={currentProofId}
              readOnly
              style={{ fontSize: 13 }}
            />

            <div
              style={{
                marginTop: 18,
                padding: 18,
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span className="stat-label">Verifier state</span>
                <span className={`pill ${statusPillClass(proofStatus)}`}>{proofStatus}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                The verifier enforces the policy hash, pool allowlist and daily rebalance cap.
                Capital moves are blocked unless all five checks pass.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 18, width: "100%" }}
              onClick={verifyProof}
              disabled={isBusy}
            >
              Verify proof
            </button>
          </div>

          <div className="section-card" style={{ padding: 28, display: "grid", gap: 12 }}>
            {proofChecks.map((check) => (
              <div
                key={check.label}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="stat-label">{check.label}</span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 14,
                      fontFamily: "Space Grotesk",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {check.value}
                  </strong>
                </div>
                <span className={`pill ${check.pass ? "pill-success" : "pill-warning"}`}>
                  {check.pass ? "Pass" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-card">
        <span className="section-kicker">Quick Actions</span>
        <h2 className="section-title">Move from proof to vault execution without leaving the page.</h2>
        <DemoControlPanel />
      </section>

      <style>{`
        @media (max-width: 980px) {
          .proof-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
