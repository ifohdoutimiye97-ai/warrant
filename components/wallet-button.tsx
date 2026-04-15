"use client";

import { shortenAddress, useWallet } from "@/components/wallet-context";

export function WalletButton() {
  const { status, address, isCorrectNetwork, hasProvider, connect, disconnect, switchNetwork } =
    useWallet();

  if (status === "connected" && address) {
    if (!isCorrectNetwork) {
      return (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            void switchNetwork();
          }}
          title="Switch to X Layer"
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--status-danger)",
              boxShadow: "0 0 8px var(--status-danger)",
              display: "inline-block",
            }}
          />
          Switch network
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={disconnect}
        title="Disconnect wallet"
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--status-success)",
            boxShadow: "0 0 8px var(--status-success)",
            display: "inline-block",
          }}
        />
        <span className="font-mono">{shortenAddress(address)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => {
        void connect();
      }}
      disabled={status === "connecting"}
      title={hasProvider ? "Connect an EVM wallet" : "Install OKX Web3 Wallet"}
    >
      {status === "connecting" ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
