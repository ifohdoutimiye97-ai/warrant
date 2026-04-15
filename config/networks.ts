/**
 * Canonical source of truth for X Layer network metadata.
 *
 * Anything that needs to talk about "which chain we are on" — deploy
 * scripts, wallet context, header pills, submission manifest — MUST read
 * from here. Do not hardcode chainId / RPC / explorer / name anywhere else.
 */

export type NetworkConfig = {
  chainId: number;
  name: string;
  shortName: string;
  rpc: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isMainnet: boolean;
};

export const X_LAYER_MAINNET: NetworkConfig = {
  chainId: 196,
  name: "X Layer mainnet",
  shortName: "X Layer",
  rpc: "https://rpc.xlayer.tech",
  blockExplorer: "https://www.okx.com/web3/explorer/xlayer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  isMainnet: true,
};

export const X_LAYER_TESTNET: NetworkConfig = {
  // NOTE: X Layer testnet chainId is 1952, not 195. Confirmed via
  // https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information
  chainId: 1952,
  name: "X Layer testnet",
  shortName: "X Layer Testnet",
  rpc: "https://testrpc.xlayer.tech/terigon",
  blockExplorer: "https://www.okx.com/web3/explorer/xlayer-test",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  isMainnet: false,
};

export const NETWORKS: Record<number, NetworkConfig> = {
  [X_LAYER_MAINNET.chainId]: X_LAYER_MAINNET,
  [X_LAYER_TESTNET.chainId]: X_LAYER_TESTNET,
};

/**
 * The chain the product is currently targeting. Default is mainnet so that
 * any code path which forgets to check ends up on the strictest config,
 * not the loosest. Deploy scripts read this via the EXPECTED_CHAIN_ID env
 * variable and enforce runtime agreement.
 */
export const DEFAULT_CHAIN_ID: number = X_LAYER_MAINNET.chainId;
export const DEFAULT_NETWORK: NetworkConfig = X_LAYER_MAINNET;

export function getNetwork(chainId: number | string | bigint | null | undefined): NetworkConfig | undefined {
  if (chainId === null || chainId === undefined) return undefined;
  const normalized = typeof chainId === "bigint" ? Number(chainId) : Number(chainId);
  if (!Number.isFinite(normalized)) return undefined;
  return NETWORKS[normalized];
}

export function requireNetwork(chainId: number): NetworkConfig {
  const network = NETWORKS[chainId];
  if (!network) {
    throw new Error(
      `Unknown chainId ${chainId}. Supported: ${Object.keys(NETWORKS).join(", ")}.`,
    );
  }
  return network;
}

export function isSupportedChain(chainId: number | null | undefined): boolean {
  return chainId != null && NETWORKS[chainId] !== undefined;
}
