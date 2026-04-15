/**
 * Warrant Uniswap Skill integration #3: TickLens.
 *
 * Reads populated ticks within the word that contains the pool's current
 * tick. This lets the Scout agent answer: "is there real liquidity
 * around the range we're about to propose, or are we about to mint into
 * dead water?" The answer is folded into the Scout rationale so the
 * warrant that lands on ProofVerifier is backed by live on-chain
 * liquidity structure, not just a snapshot price.
 *
 * Canonical X Layer deployment:
 *   https://github.com/Uniswap/contracts/blob/main/deployments/196.md
 *
 * Why TickLens specifically:
 *   Uniswap v3 pools store initialized ticks in a bitmap. Reading one
 *   tick at a time costs O(n) RPC round-trips. TickLens is Uniswap's
 *   official "batch reader" — one call returns every initialized tick
 *   inside a word of the bitmap, with their liquidityGross and
 *   liquidityNet values. It is part of the canonical Uniswap v3
 *   periphery and is NOT used by Warrant's QuoterV2 flow, so counting
 *   it as a distinct Skill module is accurate.
 */

import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import { requireNetwork } from "@/config/networks";
import { UNISWAP_XLAYER_MAINNET } from "@/config/uniswap";

const TICK_LENS_ABI = [
  "function getPopulatedTicksInWord(address pool, int16 tickBitmapIndex) external view returns ((int24 tick, int128 liquidityNet, uint128 liquidityGross)[] populatedTicks)",
] as const;

export type PopulatedTick = {
  tick: number;
  liquidityNet: string;
  liquidityGross: string;
};

export type TickNeighborhood = {
  pool: string;
  wordIndex: number;
  ticks: PopulatedTick[];
  /** Initialized ticks below currentTick in this word (closest first). */
  below: PopulatedTick[];
  /** Initialized ticks at or above currentTick in this word (closest first). */
  above: PopulatedTick[];
  /** Sum of liquidityGross across all populated ticks in the word. */
  totalLiquidityGross: string;
};

/**
 * Uniswap v3 packs tick bitmap state into 256-bit words. Each word
 * covers `256 * tickSpacing` ticks. The index of the word containing a
 * given tick is `floor(tick / tickSpacing / 256)` (not a modulo — the
 * spec uses `tick >> 8` AFTER dividing by spacing).
 */
export function wordIndexForTick(tick: number, tickSpacing: number): number {
  const compressed = Math.floor(tick / tickSpacing);
  // int16 word index — TickLens takes int16, bitshift semantics preserved.
  return compressed >> 8;
}

/**
 * Call TickLens.getPopulatedTicksInWord for the word that currently
 * contains the pool's active tick. The Scout uses this to sanity-check
 * that the proposed [lowerTick, upperTick] range straddles real
 * liquidity, not a gap in the book.
 */
export async function readTickNeighborhood(params: {
  chainId: number;
  rpcUrl?: string;
  pool: string;
  currentTick: number;
  tickSpacing: number;
}): Promise<TickNeighborhood> {
  const network = requireNetwork(params.chainId);
  const rpcUrl = params.rpcUrl ?? network.rpc;
  const provider = new JsonRpcProvider(rpcUrl);

  const tickLens = new Contract(
    UNISWAP_XLAYER_MAINNET.tickLens,
    TICK_LENS_ABI as unknown as InterfaceAbi,
    provider,
  );

  const wordIndex = wordIndexForTick(params.currentTick, params.tickSpacing);
  const raw = (await tickLens.getPopulatedTicksInWord(params.pool, wordIndex)) as Array<{
    tick: bigint;
    liquidityNet: bigint;
    liquidityGross: bigint;
  }>;

  const ticks: PopulatedTick[] = raw.map((row) => ({
    tick: Number(row.tick),
    liquidityNet: row.liquidityNet.toString(),
    liquidityGross: row.liquidityGross.toString(),
  }));

  // Sort ascending by tick, then partition around currentTick.
  ticks.sort((a, b) => a.tick - b.tick);
  const below = ticks.filter((t) => t.tick < params.currentTick).reverse(); // closest-first
  const above = ticks.filter((t) => t.tick >= params.currentTick); // already closest-first

  const totalLiquidityGross = ticks
    .reduce((acc, t) => acc + BigInt(t.liquidityGross), 0n)
    .toString();

  return {
    pool: params.pool,
    wordIndex,
    ticks,
    below,
    above,
    totalLiquidityGross,
  };
}
