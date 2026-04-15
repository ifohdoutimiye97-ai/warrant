/**
 * @fileoverview Executor Agent — verifies on-chain proof status and
 * submits proof-gated rebalance actions to LiquidityVault.
 *
 * This is the production Executor agent used by Warrant. It:
 *   1. Checks ProofVerifier.isVerified(proofId) on-chain to confirm
 *      the warrant has been accepted but not yet consumed.
 *   2. Calls LiquidityVault.executeRebalance(vaultId, proofId, action)
 *      which internally recomputes executionHash and consumes the warrant.
 *   3. Waits for tx inclusion and returns the tx hash + receipt.
 *
 * The Executor is the ONLY address allowed to call executeRebalance
 * (enforced by onlyExecutor modifier in the contract). Its private key
 * should be stored securely and funded with enough OKB for gas.
 */

import { Contract, type JsonRpcSigner, type TransactionReceipt } from "ethers";
import {
  PROOF_VERIFIER_CLIENT_ABI,
  LIQUIDITY_VAULT_CLIENT_ABI,
} from "@/lib/contracts/warrant-contracts";

export type RebalanceAction = {
  pool: string;
  lowerTick: number;
  upperTick: number;
  liquidityDelta: string;
  recipient: string;
};

export type ExecutionResult = {
  vaultId: number;
  proofId: string;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  status: "confirmed" | "reverted";
};

export class ExecutorAgent {
  constructor(private readonly agentId = "warrant-executor-agent") {}

  /**
   * Verify that a proof is accepted and unconsumed on-chain.
   * Returns true only if ProofVerifier reports the proof as verified
   * AND not yet consumed.
   */
  async verifyProofOnChain(
    proofVerifierAddress: string,
    proofId: string,
    signer: JsonRpcSigner,
  ): Promise<boolean> {
    const verifier = new Contract(proofVerifierAddress, PROOF_VERIFIER_CLIENT_ABI, signer);
    const isVerified: boolean = await verifier.isVerified(proofId);
    return isVerified;
  }

  /**
   * Execute a rebalance on-chain. The vault will:
   *   1. Recompute executionHash from the action struct
   *   2. Call ProofVerifier.consumeProof to match + burn the warrant
   *   3. Call StrategyRegistry.consumeRebalance to decrement the daily cap
   *   4. Emit RebalanceExecuted with all structured parameters
   *
   * Reverts if:
   *   - Caller is not the registered executor
   *   - Vault is inactive
   *   - Proof is not verified or already consumed
   *   - executionHash doesn't match
   *   - Daily cap is exhausted
   */
  async executeRebalance(
    liquidityVaultAddress: string,
    vaultId: number,
    proofId: string,
    action: RebalanceAction,
    signer: JsonRpcSigner,
  ): Promise<ExecutionResult> {
    const vault = new Contract(liquidityVaultAddress, LIQUIDITY_VAULT_CLIENT_ABI, signer);

    const tx = await vault.executeRebalance(vaultId, proofId, {
      pool: action.pool,
      lowerTick: action.lowerTick,
      upperTick: action.upperTick,
      liquidityDelta: action.liquidityDelta,
      recipient: action.recipient,
    });

    const receipt: TransactionReceipt = await tx.wait();

    return {
      vaultId,
      proofId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "confirmed" : "reverted",
    };
  }

  explainExecution(result: ExecutionResult) {
    return {
      agentId: this.agentId,
      summary:
        result.status === "confirmed"
          ? `Rebalance executed at block ${result.blockNumber}. Gas used: ${result.gasUsed}. Tx: ${result.txHash}`
          : `Rebalance REVERTED at block ${result.blockNumber}. Tx: ${result.txHash}`,
      result,
    };
  }
}
