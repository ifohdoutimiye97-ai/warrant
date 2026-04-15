"use client";

import { Contract } from "ethers";
import { useState } from "react";
import { DemoControlPanel } from "@/components/demo-control-panel";
import { useDemo } from "@/components/demo-provider";
import { ScoutChat } from "@/components/scout-chat";
import { useWallet } from "@/components/wallet-context";
import { useLiveDeployment } from "@/components/live-deployment-context";
import { CURATED_POOLS, DEFAULT_POOL_ADDRESS } from "@/config/uniswap";
import { LIQUIDITY_VAULT_CLIENT_ABI } from "@/lib/contracts/warrant-contracts";
import { isPlaceholder } from "@/lib/manifest-helpers";

function bubbleLabel(role: "owner" | "agent" | "system") {
  if (role === "owner") return "Owner";
  if (role === "agent") return "Warrant";
  return "System";
}

function roleClass(role: "owner" | "agent" | "system") {
  if (role === "owner") return "is-owner";
  if (role === "system") return "is-system";
  return "";
}

type LiveTxStatus =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "success"; txHash: string }
  | { kind: "error"; message: string };

export function TerminalWorkbench() {
  const {
    currentProofId,
    isBusy,
    maxRebalancesPerDay,
    position,
    proofStatus,
    rebalancesToday,
    runTerminalCommand,
    runLiveScoutProposal,
    clearLiveProposal,
    liveProposal,
    terminalMessages,
    terminalSuggestions,
  } = useDemo();
  const { manifest, hasLiveManifest } = useLiveDeployment();
  const { address, chainId, isCorrectNetwork, connect, switchNetwork, getSigner } = useWallet();
  const [draft, setDraft] = useState("");
  const [liveTx, setLiveTx] = useState<LiveTxStatus>({ kind: "idle" });
  const [selectedPool, setSelectedPool] = useState<string>(DEFAULT_POOL_ADDRESS);

  // The live scout button is active whenever we can reach X Layer at
  // all — either the user has a wallet on the target chain, or we just
  // use the manifest's chain id as the target. It works in demo mode
  // too, because it only reads on-chain state (no signing needed).
  const liveChainId = isCorrectNetwork && chainId ? chainId : manifest.chainId;
  const liveRecipient = address ?? "0x0000000000000000000000000000000000000000";

  const hasLiveVault = hasLiveManifest && !isPlaceholder(manifest.liquidityVault);

  async function handleExecuteOnChain() {
    if (!liveProposal) return;
    if (!hasLiveVault) {
      setLiveTx({
        kind: "error",
        message: "No live LiquidityVault in the deployment manifest yet.",
      });
      return;
    }
    const signer = await getSigner();
    if (!signer) {
      setLiveTx({ kind: "error", message: "Connect a wallet to sign the execution tx." });
      return;
    }

    try {
      setLiveTx({
        kind: "pending",
        message: "Submitting LiquidityVault.executeRebalance(vaultId, proofId, action)…",
      });

      // Hackathon-demo vault id. In a real product the owner would
      // pick the vault they want to rebalance; we use #1 because the
      // deployer seeds a single demo vault at startup.
      const vaultId = 1;

      const vault = new Contract(
        manifest.liquidityVault,
        LIQUIDITY_VAULT_CLIENT_ABI,
        signer,
      );
      const tx = await vault.executeRebalance(
        vaultId,
        liveProposal.proposalHash,
        {
          pool: liveProposal.action.pool,
          lowerTick: liveProposal.action.lowerTick,
          upperTick: liveProposal.action.upperTick,
          liquidityDelta: liveProposal.action.liquidityDelta,
          recipient: liveProposal.action.recipient,
        },
      );
      setLiveTx({
        kind: "pending",
        message: `Waiting for inclusion: ${tx.hash.slice(0, 10)}…`,
      });
      await tx.wait();
      setLiveTx({ kind: "success", txHash: tx.hash });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Execution call reverted.";
      setLiveTx({ kind: "error", message });
    }
  }

  const submit = () => {
    const command = draft.trim();
    if (!command) return;
    runTerminalCommand(command);
    setDraft("");
  };

  const sideStats = [
    { label: "Proof state", value: proofStatus.toUpperCase() },
    { label: "Current proof", value: currentProofId, mono: true },
    { label: "Vault range", value: position.range },
    { label: "Net fees", value: position.fees },
    { label: "Daily moves", value: `${rebalancesToday} / ${maxRebalancesPerDay}` },
  ];

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Command Terminal</span>
        <h1 className="section-title">Drive the warrant gate from a single console.</h1>
        <p className="hero-copy">
          Follow the numbered steps below. Each step must complete before the next is allowed.
          No warrant, no move.
        </p>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {[
            { step: "①", label: "Compile strategy", desc: "Register a demo LP policy" },
            { step: "②", label: "Scout proposal", desc: "Generate a proof-backed range" },
            { step: "③", label: "Verify proof", desc: "Clear the warrant gate" },
            { step: "④", label: "Execute rebalance", desc: "Move vault capital" },
            { step: "⚡", label: "Live scout", desc: "Read real X Layer Uniswap v3 data" },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                padding: "14px 16px",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: "Space Grotesk",
                  fontSize: 20,
                  fontWeight: 600,
                  color: item.step === "⚡" ? "var(--status-success)" : "var(--brand-cyan)",
                }}
              >
                {item.step}
              </span>
              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                  fontFamily: "Space Grotesk",
                  fontSize: 13,
                  color: "var(--text-primary)",
                }}
              >
                {item.label}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 11.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {item.desc}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.7fr)",
            gap: 24,
            marginTop: 32,
          }}
          className="terminal-layout-grid"
        >
          <div className="terminal-shell">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="terminal-route">
                warrant://terminal · {manifest.network} · chain {manifest.chainId}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                maxHeight: 480,
                overflow: "auto",
                paddingRight: 6,
              }}
            >
              {terminalMessages.map((message) => (
                <article className="terminal-bubble" key={message.id}>
                  <span className={`terminal-role ${roleClass(message.role)}`}>
                    {bubbleLabel(message.role)}
                  </span>
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "var(--text-primary)",
                    }}
                  >
                    {message.text}
                  </p>
                </article>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                paddingTop: 4,
              }}
            >
              <span className="stat-label" style={{ margin: 0 }}>
                Uniswap pool
              </span>
              <select
                className="input"
                value={selectedPool}
                onChange={(event) => setSelectedPool(event.target.value)}
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  width: "auto",
                  minWidth: 220,
                  background: "var(--surface-1)",
                }}
                disabled={isBusy}
              >
                {CURATED_POOLS.map((pool) => (
                  <option key={pool.address} value={pool.address}>
                    {pool.label} · {(pool.fee / 10000).toFixed(2)}% ·{" "}
                    {pool.address.slice(0, 6)}…{pool.address.slice(-4)}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Reads live from X Layer chainId {liveChainId} · no wallet required
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {terminalSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => runTerminalCommand(suggestion)}
                  disabled={isBusy}
                >
                  {suggestion}
                </button>
              ))}
              <button
                type="button"
                className="suggestion-chip"
                style={{
                  borderColor: "rgba(94, 234, 212, 0.35)",
                  background: "rgba(94, 234, 212, 0.08)",
                  color: "var(--status-success)",
                }}
                onClick={() =>
                  void runLiveScoutProposal({
                    chainId: liveChainId,
                    strategyId: 1,
                    risk: "medium",
                    recipient: liveRecipient,
                    poolAddress: selectedPool,
                  })
                }
                disabled={isBusy}
                title={`Read live Uniswap v3 pool state from chain ${liveChainId}`}
              >
                ⚡ Live scout (X Layer Uniswap v3)
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "stretch",
              }}
            >
              <textarea
                className="textarea"
                placeholder="Type a command — try: Verify proof"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                style={{ minHeight: 96 }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={isBusy}
                style={{ alignSelf: "stretch", height: "auto", minHeight: 96 }}
              >
                Send
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -4 }}>
              <span className="kbd">⌘ Enter</span>
              <span style={{ marginLeft: 8 }}>or click Send to run a command</span>
            </p>
          </div>

          <aside style={{ display: "grid", gap: 12 }}>
            {sideStats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <span className="stat-label">{stat.label}</span>
                <strong
                  className={`stat-value ${stat.mono ? "font-mono" : ""}`}
                  style={stat.mono ? { fontSize: "1.05rem" } : undefined}
                >
                  {stat.value}
                </strong>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <ScoutChat />
      </section>

      {liveProposal ? (
        <section className="section-card">
          <span className="section-kicker">Live Warrant</span>
          <h2 className="section-title">
            Bound to Uniswap v3 · {liveProposal.token0Symbol} / {liveProposal.token1Symbol}
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "var(--status-success)",
              marginBottom: 8,
              fontFamily: "Space Grotesk",
              letterSpacing: "0.04em",
            }}
          >
            This data is live from X Layer mainnet — not mock.
          </p>
          <p className="hero-copy" style={{ fontSize: 14 }}>
            Scout read block {liveProposal.blockNumber} on {liveProposal.networkName} and committed
            both a proposal hash and a concrete execution hash. The execution hash is{" "}
            <span className="font-mono" style={{ color: "var(--brand-cyan)" }}>
              {liveProposal.executionHash.slice(0, 12)}…
            </span>
            . The vault will recompute the same value on-chain and revert if anything drifts.
          </p>

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <span className="stat-label">Pool</span>
              <strong
                className="font-mono"
                style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--brand-cyan)" }}
              >
                {liveProposal.action.pool.slice(0, 10)}…{liveProposal.action.pool.slice(-6)}
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
              <span className="stat-label">Range</span>
              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                  fontFamily: "Space Grotesk",
                  color: "var(--text-primary)",
                }}
              >
                [{liveProposal.action.lowerTick}, {liveProposal.action.upperTick}]
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
              <span className="stat-label">Fee tier</span>
              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                  fontFamily: "Space Grotesk",
                  color: "var(--text-primary)",
                }}
              >
                {liveProposal.feeBps} bps
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
              <span className="stat-label">Spot {liveProposal.token1Symbol}</span>
              <strong
                style={{
                  display: "block",
                  marginTop: 6,
                  fontFamily: "Space Grotesk",
                  color: "var(--text-primary)",
                }}
              >
                {liveProposal.priceToken1InToken0} {liveProposal.token0Symbol}
              </strong>
            </div>
          </div>

          {liveProposal.quote ? (
            <div
              style={{
                marginTop: 18,
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(143, 245, 255, 0.06), transparent 60%), var(--surface-3)",
                border: "1px solid rgba(143, 245, 255, 0.25)",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span className="stat-label">Uniswap QuoterV2 simulation</span>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 13.5,
                      color: "var(--text-primary)",
                    }}
                  >
                    Swapping{" "}
                    <strong className="font-mono" style={{ color: "var(--brand-cyan)" }}>
                      1 {liveProposal.quote.tokenIn.symbol}
                    </strong>{" "}
                    at the current pool state yields{" "}
                    <strong className="font-mono" style={{ color: "var(--brand-cyan)" }}>
                      {liveProposal.quote.amountOut} {liveProposal.quote.tokenOut.symbol}
                    </strong>{" "}
                    ·{" "}
                    <span style={{ color: "var(--text-secondary)" }}>
                      ticks crossed: {liveProposal.quote.initializedTicksCrossed}, gas estimate{" "}
                      {liveProposal.quote.gasEstimate}
                    </span>
                  </p>
                </div>
                <span className="pill pill-cyan">Skill: QuoterV2</span>
              </div>
            </div>
          ) : null}

          {liveProposal.skillCalls.length > 0 ? (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                background: "var(--surface-3)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <span className="stat-label">Uniswap Skill calls issued ({liveProposal.skillCalls.length})</span>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {liveProposal.skillCalls.map((call, index) => (
                  <span
                    key={`${call.skill}-${call.method}-${index}`}
                    className="font-mono"
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      background: "rgba(143, 245, 255, 0.08)",
                      border: "1px solid rgba(143, 245, 255, 0.25)",
                      color: "var(--brand-cyan)",
                    }}
                    title={call.contract}
                  >
                    {call.skill}.{call.method}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {hasLiveVault && isCorrectNetwork ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleExecuteOnChain()}
                disabled={liveTx.kind === "pending"}
              >
                {liveTx.kind === "pending" ? "Submitting…" : "Execute warrant on-chain"}
              </button>
            ) : !hasLiveVault ? (
              <span className="pill pill-warning">
                Template manifest — execute path disabled until contracts are deployed
              </span>
            ) : !isCorrectNetwork && address ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void switchNetwork()}
              >
                Switch network
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void connect()}
              >
                Connect wallet
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={clearLiveProposal}>
              Discard proposal
            </button>
          </div>

          {liveTx.kind === "pending" ? (
            <p style={{ marginTop: 14, fontSize: 12, color: "var(--status-warning)" }}>
              {liveTx.message}
            </p>
          ) : null}
          {liveTx.kind === "success" ? (
            <p
              style={{
                marginTop: 14,
                fontSize: 12,
                color: "var(--status-success)",
                wordBreak: "break-all",
              }}
            >
              Execution confirmed.{" "}
              <a
                href={`${manifest.blockExplorer}/tx/${liveTx.txHash}`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono"
                style={{ color: "var(--status-success)", textDecoration: "underline" }}
              >
                {liveTx.txHash.slice(0, 10)}…{liveTx.txHash.slice(-6)}
              </a>
            </p>
          ) : null}
          {liveTx.kind === "error" ? (
            <p style={{ marginTop: 14, fontSize: 12, color: "var(--status-danger)" }}>
              {liveTx.message}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="section-card">
        <span className="section-kicker">Quick Control</span>
        <h2 className="section-title">Buttons and terminal commands share the same proof state.</h2>
        <DemoControlPanel />
      </section>

      <style>{`
        @media (max-width: 1024px) {
          .terminal-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
