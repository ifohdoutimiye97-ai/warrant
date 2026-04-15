import {
  artifactInventory,
  proofPacket,
  readinessTasks,
  submissionCommands,
  skillUsage,
  submissionChecklist,
  submissionFormCopy,
  submissionLinks,
  submissionOverview,
  teamTemplate,
} from "@/lib/submission-data";
import type { AgentEntry, ContractEntry, DeploymentManifest } from "@/lib/deployment-manifest";

type SubmissionPanelProps = {
  manifest: DeploymentManifest;
  manifestFile: string;
  hasLiveManifest: boolean;
  contractEntries: ContractEntry[];
  agentEntries: AgentEntry[];
};

function DataCard({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <span className="stat-label">{label}</span>
      <strong
        style={{
          display: "block",
          marginTop: 8,
          fontFamily: "Space Grotesk",
          fontSize: 15,
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
      {note ? (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function SubmissionPanel({
  manifest,
  manifestFile,
  hasLiveManifest,
  contractEntries,
  agentEntries,
}: SubmissionPanelProps) {
  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Submission Packet</span>
        <h1 className="section-title">Everything judges expect to see, in one place.</h1>
        <p className="hero-copy">
          This page compiles the data that a Build X Season 2 judge would want: narrative,
          agents, contracts, proof packet, and readiness status. It auto-switches from
          template to live manifest once X Layer addresses land.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginTop: 28,
          }}
        >
          <DataCard
            label="Project"
            value={submissionOverview.projectName}
            note={submissionOverview.shortPitch}
          />
          <DataCard
            label="Track"
            value={submissionOverview.category}
            note={`Primary pool: ${submissionOverview.targetPool}`}
          />
          <DataCard
            label="Integrations"
            value={submissionOverview.primaryIntegrations.join(" + ")}
            note="All core flows are designed around these integrations."
          />
          <DataCard
            label="Manifest"
            value={
              <span className="font-mono" style={{ fontSize: 12 }}>
                {manifestFile}
              </span>
            }
            note={
              hasLiveManifest ? (
                <span className="pill pill-success" style={{ marginTop: 4 }}>
                  Live manifest loaded
                </span>
              ) : (
                <span className="pill pill-warning" style={{ marginTop: 4 }}>
                  Template fallback
                </span>
              )
            }
          />
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="submit-two-col"
      >
        <section className="section-card">
          <span className="section-kicker">Submission Commands</span>
          <h2 className="section-title">Use the repo like a real delivery pipeline.</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {submissionCommands.map((item) => (
              <div
                key={item.command}
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
                    flexWrap: "wrap",
                    gap: 8,
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
                    {item.name}
                  </h3>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--brand-cyan)" }}>
                    {item.command}
                  </span>
                </div>
                <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <span className="section-kicker">Form Copy</span>
          <h2 className="section-title">Keep the narrative short and consistent.</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {submissionFormCopy.map((item) => (
              <div
                key={item.field}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <span className="stat-label">{item.field}</span>
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="submit-two-col"
      >
        <section className="section-card">
          <span className="section-kicker">Agent Identities</span>
          <h2 className="section-title">Document every wallet before submission.</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {agentEntries.map((agent) => (
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
                    flexWrap: "wrap",
                    gap: 8,
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
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {agent.address}
                  </span>
                </div>
                <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {agent.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <span className="section-kicker">Skill Usage</span>
          <h2 className="section-title">Where required integrations actually appear.</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {skillUsage.map((item) => (
              <div
                key={item.name}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "Space Grotesk",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--brand-cyan)",
                  }}
                >
                  {item.name}
                </h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="section-card">
        <span className="section-kicker">Deployment Manifest</span>
        <h2 className="section-title">Fill contract addresses after X Layer deployment.</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 24,
          }}
        >
          {contractEntries.map((contract) => (
            <div
              key={contract.name}
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <h3
                className="font-mono"
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--brand-cyan)",
                }}
              >
                {contract.name}
              </h3>
              <span
                className="font-mono"
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  wordBreak: "break-all",
                }}
              >
                {contract.address}
              </span>
              <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {contract.purpose}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <DataCard label="network" value={manifest.network} />
          <DataCard label="chainId" value={manifest.chainId} />
          <DataCard
            label="rpc"
            value={<span style={{ fontSize: 12 }}>{manifest.rpc}</span>}
          />
          <DataCard
            label="block explorer"
            value={<span style={{ fontSize: 12 }}>{manifest.blockExplorer}</span>}
          />
          <DataCard
            label="verifier backend"
            value={manifest.verifierBackend ?? "TBD_AFTER_DEPLOYMENT"}
          />
          <DataCard
            label="proof mode"
            value={manifest.insecureProofs ? "insecure demo mode" : "verifier backed"}
          />
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(proofPacket).map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <span className="stat-label">{label}</span>
              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontFamily: "Space Grotesk",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  wordBreak: "break-all",
                }}
              >
                {String(value)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="submit-two-col"
      >
        <section className="section-card">
          <span className="section-kicker">Artifacts</span>
          <h2 className="section-title">Concrete build outputs already in the repo.</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            {artifactInventory.map((item) => (
              <div
                key={item.path}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontFamily: "Space Grotesk", fontSize: 13, color: "var(--text-primary)" }}>
                    {item.name}
                  </strong>
                  <br />
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {item.path}
                  </span>
                </div>
                <span className="pill pill-success">{item.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <span className="section-kicker">Final Sprint</span>
          <h2 className="section-title">Close the last gaps before submitting.</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            {readinessTasks.map((task) => (
              <div
                key={task.title}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <strong
                    style={{
                      fontFamily: "Space Grotesk",
                      fontSize: 13,
                      color: "var(--text-primary)",
                    }}
                  >
                    {task.title}
                  </strong>
                  <span className={`pill ${task.status === "Done" ? "pill-success" : "pill-warning"}`}>
                    {task.status}
                  </span>
                </div>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {task.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="submit-two-col"
      >
        <section className="section-card">
          <span className="section-kicker">Checklist</span>
          <h2 className="section-title">Use this before touching the Google Form.</h2>
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            {submissionChecklist.map((item) => (
              <div
                key={item}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{item}</span>
                <span className="pill pill-neutral">Required</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <span className="section-kicker">Team And Links</span>
          <h2 className="section-title">Replace placeholders before publishing.</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 10,
              marginTop: 20,
            }}
          >
            {teamTemplate.map((item) => (
              <DataCard key={item.field} label={item.field} value={item.value} />
            ))}
            {submissionLinks.map((item) => (
              <DataCard key={item.field} label={item.field} value={item.value} />
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .submit-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
