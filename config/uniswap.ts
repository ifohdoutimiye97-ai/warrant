/**
 * Canonical Uniswap v3 deployment metadata for X Layer.
 *
 * Source: https://github.com/Uniswap/contracts/blob/main/deployments/196.md
 *         (official Uniswap deployments manifest, chain 196, Dec 4 2025).
 *
 * We list the exact addresses our scout agent reads from. Changing any
 * value here ripples through lib/uniswap/* and the /api/scout route —
 * this file is the single source of truth.
 */

export type UniswapDeployment = {
  chainId: number;
  v3Factory: `0x${string}`;
  swapRouter02: `0x${string}`;
  nonfungiblePositionManager: `0x${string}`;
  quoterV2: `0x${string}`;
  tickLens: `0x${string}`;
};

export type TokenInfo = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type CuratedPool = {
  label: string;
  address: `0x${string}`;
  /**
   * Raw Uniswap v3 fee value, NOT basis points.
   *
   *   100   = 0.01%
   *   500   = 0.05%
   *   3000  = 0.3%
   *   10000 = 1%
   *
   * This matches the value returned by `UniswapV3Pool.fee() returns (uint24)`.
   */
  fee: number;
};

/** Uniswap v3 core + periphery on X Layer mainnet (chainId 196). */
export const UNISWAP_XLAYER_MAINNET: UniswapDeployment = {
  chainId: 196,
  v3Factory: "0x4b2ab38dbf28d31d467aa8993f6c2585981d6804",
  swapRouter02: "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15",
  nonfungiblePositionManager: "0x315e413a11ab0df498ef83873012430ca36638ae",
  quoterV2: "0xd1b797d92d87b688193a2b976efc8d577d204343",
  tickLens: "0x661e93cca42afacb172121ef892830ca3b70f08d",
};

/**
 * Well-known ERC20 tokens on X Layer mainnet. Addresses verified via
 * the OKLink X Layer explorer in April 2026.
 */
export const XLAYER_TOKENS: Record<string, TokenInfo> = {
  WETH: {
    symbol: "WETH",
    address: "0x5a77f1443d16ee5761d310e38b62f77f726bc71c",
    decimals: 18,
  },
  USDC: {
    symbol: "USDC",
    address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    address: "0x1e4a5963abfd975d8c9021ce480b42188849d41d",
    decimals: 6,
  },
  WBTC: {
    symbol: "WBTC",
    address: "0xea034fb02eb1808c2cc3adbc15f447b93cbe08e1",
    decimals: 8,
  },
};

/**
 * Curated list of high-liquidity Uniswap v3 pools on X Layer that the
 * scout agent can read from. These are shipped with the product so the
 * demo has something meaningful to show on mainnet the moment the
 * contracts deploy — no "TBD pool address" placeholder.
 *
 * Pool addresses verified via GeckoTerminal
 * (https://www.geckoterminal.com/x-layer/uniswap-v3-x-layer/pools).
 */
export const CURATED_POOLS: CuratedPool[] = [
  {
    label: "xETH / USDT0",
    address: "0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc",
    fee: 500, // 0.05%
  },
  {
    label: "xBTC / USDT0",
    address: "0x5fcfb33c9ab1665fee892eb2af163e863a874d73",
    fee: 500, // 0.05%
  },
  {
    label: "USDT0 / WOKB",
    address: "0x63d62734847e55a266fca4219a9ad0a02d5f6e02",
    fee: 3000, // 0.3%
  },
];

/** The default pool our scout agent targets when no explicit pool is passed. */
export const DEFAULT_POOL_ADDRESS: `0x${string}` = CURATED_POOLS[0].address;
