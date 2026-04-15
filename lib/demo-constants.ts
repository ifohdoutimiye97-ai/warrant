/**
 * Single source of truth for values that get displayed across the demo UI,
 * referenced by the submission packet, and fed into mock data. If you need
 * to change a starter number, a sample proof id, or the initial position,
 * change it HERE, not in five other files.
 *
 * Rule: nothing outside this module is allowed to hardcode any of these
 * values. If grep shows a duplicate somewhere, it is a bug.
 */

// ---- Sample proof metadata ------------------------------------------------

export const SAMPLE_PROOF_ID = "proof_0x91af...b17d";
export const SAMPLE_STRATEGY_HASH = "0x14bd...1f2a";
export const SAMPLE_PROPOSAL_HASH = "0xa912...4ef0";
export const SAMPLE_EXECUTION_HASH = "0x5e08...7b11";
export const SAMPLE_PUBLIC_INPUTS_HASH = "0x7cd1...22ab";

// ---- Strategy defaults ----------------------------------------------------

export const DEFAULT_PROMPT =
  "Run a medium-risk ETH/USDC liquidity strategy on X Layer with at most 2 rebalances per day and no moves outside the declared pool.";

export const DEFAULT_POOL = "WETH / USDC";
export const DEFAULT_RISK = "Medium";
export const DEFAULT_MAX_REBALANCES_PER_DAY = 2;

// ---- Position bootstrap ---------------------------------------------------

export const INITIAL_POSITION = {
  pool: "X Layer Uniswap WETH/USDC",
  range: "1,850 - 2,040",
  tvl: "$12.4k",
  fees: "$194.22",
} as const;

// ---- Dashboard range bar chart extents (used by P2-09) --------------------
/** Fallback range when position.range fails to parse (e.g. corrupt string). */
export const DEFAULT_RANGE_FALLBACK: [number, number] = [1850, 2040];

/** Lower bound of the demo price axis. */
export const PRICE_CHART_MIN = 1600;
/** Upper bound of the demo price axis. */
export const PRICE_CHART_MAX = 2400;
/** Current reference price for the demo marker. */
export const PRICE_CHART_REFERENCE = 1950;
