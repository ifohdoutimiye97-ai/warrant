/**
 * Scout planning logic that converts a live PoolSnapshot + owner-declared
 * risk profile into a concrete RebalanceAction. This is deterministic:
 * same snapshot + same risk = same proposal. The scout agent wraps this
 * with I/O (pool reader + proof packaging).
 */

import { AbiCoder, keccak256, solidityPacked } from "ethers";
import type { PoolSnapshot } from "./pool-reader";

export type RiskProfile = "low" | "medium" | "high";

export type RebalanceAction = {
  pool: string;
  lowerTick: number;
  upperTick: number;
  liquidityDelta: string; // int256 as string
  recipient: string;
};

export type RebalanceProposal = {
  strategyId: number;
  snapshot: PoolSnapshot;
  action: RebalanceAction;
  proposalHash: string;
  executionHash: string;
  rationale: string;
};

/**
 * Given a pool's current tick and tickSpacing, round a target tick DOWN
 * to the nearest multiple of tickSpacing. Uniswap v3 requires all
 * position ticks to be spacing-aligned or the mint reverts.
 */
function alignTickDown(tick: number, spacing: number) {
  return Math.floor(tick / spacing) * spacing;
}

function alignTickUp(tick: number, spacing: number) {
  return Math.ceil(tick / spacing) * spacing;
}

/**
 * Each risk profile maps to a half-width (in ticks * spacing) of the
 * position we center around the current tick. Wider = safer = less
 * impermanent loss protection but more uptime inside range.
 */
function halfWidthForRisk(risk: RiskProfile): number {
  // Measured in multiples of tickSpacing.
  if (risk === "low") return 40;
  if (risk === "high") return 8;
  return 18; // medium
}

/**
 * Convert an owner risk level into a concrete range around the pool's
 * current tick. Result is deterministic: hash inputs, get same output.
 */
export function planRebalance(params: {
  strategyId: number;
  snapshot: PoolSnapshot;
  risk: RiskProfile;
  recipient: string;
  /** Optional override of desired liquidity delta; defaults to "0" (no-op). */
  liquidityDelta?: string;
}): RebalanceProposal {
  const { strategyId, snapshot, risk, recipient } = params;
  const halfWidthSteps = halfWidthForRisk(risk);
  const halfWidthTicks = halfWidthSteps * snapshot.tickSpacing;

  const lowerTick = alignTickDown(snapshot.currentTick - halfWidthTicks, snapshot.tickSpacing);
  const upperTick = alignTickUp(snapshot.currentTick + halfWidthTicks, snapshot.tickSpacing);

  const liquidityDelta = params.liquidityDelta ?? "0";

  const action: RebalanceAction = {
    pool: snapshot.poolAddress,
    lowerTick,
    upperTick,
    liquidityDelta,
    recipient,
  };

  // Execution hash MUST match the recomputation performed inside
  // LiquidityVault.executeRebalance which uses `abi.encode` (NOT
  // `abi.encodePacked`). Using AbiCoder here so both sides produce
  // identical 32-byte-padded encoding → identical keccak256.
  const coder = AbiCoder.defaultAbiCoder();
  const executionHash = keccak256(
    coder.encode(
      ["address", "int24", "int24", "int256", "address"],
      [action.pool, action.lowerTick, action.upperTick, action.liquidityDelta, action.recipient],
    ),
  );

  // Proposal hash commits to the intent, not the concrete parameters.
  // This gives evaluators something human-readable to tie back to the
  // scout's natural-language rationale.
  const proposalHash = keccak256(
    solidityPacked(
      ["uint256", "address", "int24", "string"],
      [strategyId, snapshot.poolAddress, snapshot.currentTick, risk],
    ),
  );

  const width = upperTick - lowerTick;
  const rationale =
    `Risk=${risk}, current tick=${snapshot.currentTick}, ` +
    `proposing range [${lowerTick}, ${upperTick}] (width=${width} ticks, ` +
    `${halfWidthSteps}× tickSpacing each side). ` +
    `Spot ${snapshot.token0.symbol}/${snapshot.token1.symbol} = ${snapshot.priceToken0InToken1}.`;

  return {
    strategyId,
    snapshot,
    action,
    proposalHash,
    executionHash,
    rationale,
  };
}
