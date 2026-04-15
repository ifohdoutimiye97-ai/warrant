/**
 * @fileoverview Scout Agent — reads live Uniswap v3 pool state from
 * X Layer and produces proof-ready rebalance proposals.
 *
 * This is the **real** Scout agent used by Warrant on mainnet. It:
 *   1. Reads slot0/liquidity/token metadata from a concrete pool via
 *      lib/uniswap/pool-reader.ts (JSON-RPC calls against X Layer).
 *   2. Converts the pool snapshot + owner risk profile into a concrete
 *      RebalanceAction via lib/uniswap/scout.ts.
 *   3. Computes the executionHash the way LiquidityVault.executeRebalance
 *      will recompute it on-chain, so the proof gate can bind the two.
 *
 * The Scout agent does NOT sign or submit the proof itself — that
 * responsibility belongs to the server-side /api/scout/propose route
 * (which wraps this class with HTTP + authentication).
 */

import { readPoolState, type PoolSnapshot } from "@/lib/uniswap/pool-reader";
import { planRebalance, type RebalanceProposal, type RiskProfile } from "@/lib/uniswap/scout";

export type ScoutInput = {
  chainId: number;
  poolAddress: string;
  strategyId: number;
  risk: RiskProfile;
  recipient: string;
  rpcUrl?: string;
};

export class ScoutAgent {
  constructor(private readonly agentId = "warrant-scout-agent") {}

  /** Read the current pool state via Uniswap v3 slot0/liquidity calls. */
  async readPoolState(chainId: number, poolAddress: string, rpcUrl?: string): Promise<PoolSnapshot> {
    return readPoolState({ chainId, poolAddress, rpcUrl });
  }

  /** End-to-end: read pool + plan rebalance under the declared risk profile. */
  async proposeRebalance(input: ScoutInput): Promise<RebalanceProposal> {
    const snapshot = await this.readPoolState(input.chainId, input.poolAddress, input.rpcUrl);
    return planRebalance({
      strategyId: input.strategyId,
      snapshot,
      risk: input.risk,
      recipient: input.recipient,
    });
  }

  explainProposal(proposal: RebalanceProposal) {
    return {
      agentId: this.agentId,
      summary: proposal.rationale,
      strategyId: proposal.strategyId,
      poolAddress: proposal.action.pool,
      lowerTick: proposal.action.lowerTick,
      upperTick: proposal.action.upperTick,
      proposalHash: proposal.proposalHash,
      executionHash: proposal.executionHash,
    };
  }
}
