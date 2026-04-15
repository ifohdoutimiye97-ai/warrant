"use client";

import { Contract, keccak256, toUtf8Bytes } from "ethers";
import { useState } from "react";
import { useDemo } from "@/components/demo-provider";
import { useLiveDeployment } from "@/components/live-deployment-context";
import { useWallet } from "@/components/wallet-context";
import { isPlaceholder } from "@/lib/manifest-helpers";

import { STRATEGY_REGISTRY_CLIENT_ABI } from "@/lib/contracts/warrant-contracts";
import { DEFAULT_POOL_ADDRESS } from "@/config/uniswap";

function riskLevelFromLabel(label: string) {
  if (/low/i.test(label)) return 1;
  if (/high/i.test(label)) return 3;
  return 2;
}

type OnchainStatus =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "success"; txHash: string; strategyId?: string }
  | { kind: "error"; message: string };

export function StrategyStudio() {
  const { generateStrategy, isBusy, prompt, setPrompt, strategyPreview } = useDemo();
  const { hasLiveManifest, manifest } = useLiveDeployment();
  const { status: walletStatus, isCorrectNetwork, connect, switchNetwork, getSigner } = useWallet();
  const [onchainStatus, setOnchainStatus] = useState<OnchainStatus>({ kind: "idle" });

  const registryAddress = manifest.strategyRegistry;
  const hasLiveRegistry = hasLiveManifest && !isPlaceholder(registryAddress);

  const risk = strategyPreview.find((item) => item.label === "Risk profile")?.value ?? "Medium";
  const pool = strategyPreview.find((item) => item.label === "Pool")?.value ?? "WETH / USDC";
  const dailyCap = Number(
    strategyPreview.find((item) => item.label === "Max rebalances per day")?.value ?? "2",
  );

  const canDeployOnchain =
    hasLiveRegistry &&
    walletStatus === "connected" &&
    isCorrectNetwork &&
    onchainStatus.kind !== "pending";

  const handleDeployOnchain = async () => {
    if (!hasLiveRegistry) return;
    const signer = await getSigner();
    if (!signer) {
      setOnchainStatus({
        kind: "error",
        message: "No signer available. Connect a wallet and try again.",
      });
      return;
    }

    const metadataHash = keccak256(
      toUtf8Bytes(`warrant:${risk}:${pool}:${dailyCap}:${prompt}`),
    );

    try {
      setOnchainStatus({
        kind: "pending",
        message: "Submitting createStrategy to StrategyRegistry…",
      });

      const registry = new Contract(registryAddress, STRATEGY_REGISTRY_CLIENT_ABI, signer);
      const tx = await registry.createStrategy(
        DEFAULT_POOL_ADDRESS,
        BigInt(dailyCap),
        riskLevelFromLabel(risk),
        metadataHash,
      );

      setOnchainStatus({
        kind: "pending",
        message: `Waiting for inclusion: ${tx.hash.slice(0, 10)}…`,
      });

      await tx.wait();

      setOnchainStatus({
        kind: "success",
        txHash: tx.hash,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "createStrategy call reverted.";
      setOnchainStatus({
        kind: "error",
        message,
      });
    }
  };

  const explorerBase = manifest.blockExplorer;

  return (
    <div className="page">
      <section className="section-card">
        <span className="section-kicker">Strategy Studio</span>
        <h1 className="section-title">Turn natural language into a proof-gated LP policy.</h1>
        <p className="hero-copy">
          Describe how Warrant should manage your concentrated liquidity. The compiler turns
          your intent into machine-readable guardrails that the verifier will enforce.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: 24,
            marginTop: 32,
          }}
          className="strategy-grid"
        >
          <div className="card-glow">
            <label
              htmlFor="prompt"
              style={{
                display: "block",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: 12,
              }}
            >
              Owner intent
            </label>
            <textarea
              id="prompt"
              className="textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              style={{ minHeight: 220 }}
              placeholder="Describe your strategy in plain language — for example: Run a medium-risk ETH/USDC strategy on X Layer with 2 rebalances per day. The compiler will extract risk level, pool, and daily rebalance cap."
            />
            <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => generateStrategy()}
                disabled={isBusy}
              >
                Compile warrant-ready strategy
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setPrompt(
                    "Run a medium-risk ETH/USDC strategy on X Layer with 2 rebalances per day and no moves outside the declared pool.",
                  )
                }
              >
                Use sample intent
              </button>
            </div>

            {/* Live on-chain deployment panel (P1-07) */}
            <div
              style={{
                marginTop: 24,
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
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span className="stat-label">On-chain deployment</span>
                {hasLiveRegistry ? (
                  <span className="pill pill-success">Registry live</span>
                ) : (
                  <span className="pill pill-warning">Template mode</span>
                )}
              </div>

              {!hasLiveRegistry ? (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  No live StrategyRegistry address in the deployment manifest yet. When the
                  contracts are deployed and <code>deployments/xlayer-&lt;chainId&gt;.json</code>{" "}
                  is filled in, this button becomes a real call to{" "}
                  <code>StrategyRegistry.createStrategy</code>.
                </p>
              ) : walletStatus !== "connected" ? (
                <div style={{ marginTop: 12 }}>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Connect a wallet to submit this strategy on-chain.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      void connect();
                    }}
                  >
                    Connect wallet
                  </button>
                </div>
              ) : !isCorrectNetwork ? (
                <div style={{ marginTop: 12 }}>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--status-danger)",
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Wrong network. Switch the wallet to {manifest.network} (chainId{" "}
                    {manifest.chainId}) to deploy.
                  </p>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      void switchNetwork();
                    }}
                  >
                    Switch network
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Registry:{" "}
                    <span className="font-mono" style={{ color: "var(--brand-cyan)" }}>
                      {registryAddress.slice(0, 10)}…{registryAddress.slice(-6)}
                    </span>
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      void handleDeployOnchain();
                    }}
                    disabled={!canDeployOnchain}
                  >
                    {onchainStatus.kind === "pending"
                      ? "Submitting…"
                      : "Deploy strategy on-chain"}
                  </button>
                </div>
              )}

              {onchainStatus.kind === "pending" ? (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--status-warning)",
                    lineHeight: 1.5,
                  }}
                >
                  {onchainStatus.message}
                </p>
              ) : null}

              {onchainStatus.kind === "success" ? (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--status-success)",
                    lineHeight: 1.5,
                    wordBreak: "break-all",
                  }}
                >
                  Strategy registered. tx{" "}
                  <a
                    href={`${explorerBase}/tx/${onchainStatus.txHash}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono"
                    style={{ color: "var(--status-success)", textDecoration: "underline" }}
                  >
                    {onchainStatus.txHash.slice(0, 10)}…{onchainStatus.txHash.slice(-6)}
                  </a>
                </p>
              ) : null}

              {onchainStatus.kind === "error" ? (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--status-danger)",
                    lineHeight: 1.5,
                  }}
                >
                  {onchainStatus.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="section-card" style={{ padding: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 className="h3" style={{ margin: 0 }}>
                Compiled strategy
              </h2>
              <span className="pill pill-cyan">Registry-ready</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {strategyPreview.map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    padding: 16,
                  }}
                >
                  <span className="stat-label">{item.label}</span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: 8,
                      fontFamily: "Space Grotesk",
                      color: "var(--text-primary)",
                      fontSize: 15,
                    }}
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 980px) {
          .strategy-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
