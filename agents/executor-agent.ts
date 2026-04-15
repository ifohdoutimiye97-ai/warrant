/**
 * @fileoverview Executor Agent — verifies on-chain proof status,
 * submits proof-gated rebalance actions to LiquidityVault, and
 * (optionally) performs the post-warrant liquidity-leg work against
 * canonical Uniswap v3 periphery contracts.
 *
 * This is the production Executor agent used by Warrant. It:
 *   1. Checks ProofVerifier.isVerified(proofId) on-chain to confirm
 *      the warrant has been accepted but not yet consumed.
 *   2. Calls LiquidityVault.executeRebalance(vaultId, proofId, action)
 *      which internally recomputes executionHash and consumes the warrant.
 *   3. Waits for tx inclusion and returns the tx hash + receipt.
 *   4. OPTIONAL: once the warrant is consumed, performs the actual
 *      liquidity-leg work (decreaseLiquidity + mint + collect) directly
 *      against NonfungiblePositionManager, or a swap leg against
 *      SwapRouter02. This is the "capital movement" layer and it runs
 *      at the Executor tier — NOT inside the vault — so the vault stays
 *      a small, audited proof-gate primitive (see docs/integration-guide.md).
 *
 * The Executor is the ONLY address allowed to call executeRebalance
 * (enforced by onlyExecutor modifier in the contract). Its private key
 * should be stored securely and funded with enough OKB for gas. For the
 * liquidity-leg helpers, the Executor additionally needs token approvals
 * on the NFPM / SwapRouter02 contracts for the tokens it manages.
 */

import {
  Contract,
  type ContractTransactionResponse,
  type JsonRpcSigner,
  type Signer,
  type TransactionReceipt,
} from "ethers";
import {
  PROOF_VERIFIER_CLIENT_ABI,
  LIQUIDITY_VAULT_CLIENT_ABI,
} from "@/lib/contracts/warrant-contracts";
import { UNISWAP_XLAYER_MAINNET } from "@/config/uniswap";

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

  // ==========================================================================
  //  Post-warrant liquidity-leg helpers
  //
  //  The Vault contract is intentionally a pure proof-gate primitive: it
  //  recomputes executionHash, consumes the warrant, and emits the exact
  //  RebalanceAction parameters via the RebalanceExecuted event. It does
  //  NOT call NFPM or SwapRouter02 itself — that keeps its attack surface
  //  small and its auditability trivial. The *real* capital movement is
  //  the Executor agent's job, and it happens here, AFTER the warrant is
  //  consumed on-chain.
  //
  //  Both helpers below are signer-parameterized so they can be driven
  //  by either a node-side wallet (Wallet) or a browser-side JsonRpcSigner.
  //  They each take only the inputs the corresponding Uniswap periphery
  //  contract needs — the warrant's authority is external to them.
  // ==========================================================================

  /**
   * Mint a new Uniswap v3 concentrated-liquidity position via the
   * canonical NonfungiblePositionManager on X Layer. Returns the tx
   * receipt; the caller can parse logs for the tokenId of the minted
   * position. Caller must ensure token approvals exist on NFPM before
   * invoking.
   */
  async mintPositionViaNfpm(
    signer: Signer,
    params: {
      token0: string;
      token1: string;
      fee: number;
      tickLower: number;
      tickUpper: number;
      amount0Desired: bigint;
      amount1Desired: bigint;
      amount0Min?: bigint;
      amount1Min?: bigint;
      recipient: string;
      deadlineSecondsFromNow?: number;
    },
  ): Promise<TransactionReceipt> {
    const NFPM_WRITE_ABI = [
      "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    ] as const;

    const nfpm = new Contract(
      UNISWAP_XLAYER_MAINNET.nonfungiblePositionManager,
      NFPM_WRITE_ABI,
      signer,
    );

    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + (params.deadlineSecondsFromNow ?? 600),
    );

    const tx: ContractTransactionResponse = await nfpm.mint({
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      amount0Min: params.amount0Min ?? 0n,
      amount1Min: params.amount1Min ?? 0n,
      recipient: params.recipient,
      deadline,
    });
    return (await tx.wait()) as TransactionReceipt;
  }

  /**
   * Execute the swap leg of a rebalance via SwapRouter02.exactInputSingle.
   * Returns the tx receipt. Like `mintPositionViaNfpm`, caller must have
   * pre-wired token approvals on SwapRouter02 for `tokenIn`.
   */
  async swapLegViaRouter02(
    signer: Signer,
    params: {
      tokenIn: string;
      tokenOut: string;
      fee: number;
      recipient: string;
      amountIn: bigint;
      amountOutMinimum?: bigint;
      sqrtPriceLimitX96?: bigint;
      deadlineSecondsFromNow?: number;
    },
  ): Promise<TransactionReceipt> {
    const ROUTER_WRITE_ABI = [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    ] as const;

    const router = new Contract(
      UNISWAP_XLAYER_MAINNET.swapRouter02,
      ROUTER_WRITE_ABI,
      signer,
    );

    const tx: ContractTransactionResponse = await router.exactInputSingle({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: params.fee,
      recipient: params.recipient,
      amountIn: params.amountIn,
      amountOutMinimum: params.amountOutMinimum ?? 0n,
      sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? 0n,
    });
    return (await tx.wait()) as TransactionReceipt;
  }

  /**
   * Composite: consume the warrant via `executeRebalance` first, THEN
   * perform the post-warrant liquidity-leg work (swap-then-mint or
   * modify-liquidity, depending on the action). Returns both receipts
   * so the Treasury agent can tie fees to the full tx set.
   *
   * Why two separate transactions? Because the vault's job is policy
   * enforcement, not liquidity management. Keeping the layers separate
   * means any X Layer protocol can plug its own post-warrant handler
   * without changing the proof-gate surface (see docs/integration-guide.md).
   */
  async executeRebalanceAndMint(
    signer: JsonRpcSigner,
    warrant: {
      liquidityVaultAddress: string;
      vaultId: number;
      proofId: string;
      action: RebalanceAction;
    },
    liquidity: {
      token0: string;
      token1: string;
      amount0Desired: bigint;
      amount1Desired: bigint;
    },
  ): Promise<{ warrantResult: ExecutionResult; mintReceipt: TransactionReceipt }> {
    const warrantResult = await this.executeRebalance(
      warrant.liquidityVaultAddress,
      warrant.vaultId,
      warrant.proofId,
      warrant.action,
      signer,
    );

    if (warrantResult.status !== "confirmed") {
      throw new Error(
        `executeRebalance did not confirm (status=${warrantResult.status}); skipping mint.`,
      );
    }

    const mintReceipt = await this.mintPositionViaNfpm(signer, {
      token0: liquidity.token0,
      token1: liquidity.token1,
      fee: 500, // must match the pool fee used when the warrant was signed
      tickLower: warrant.action.lowerTick,
      tickUpper: warrant.action.upperTick,
      amount0Desired: liquidity.amount0Desired,
      amount1Desired: liquidity.amount1Desired,
      recipient: warrant.action.recipient,
    });

    return { warrantResult, mintReceipt };
  }
}
