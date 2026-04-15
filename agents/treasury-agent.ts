/**
 * @fileoverview Treasury Agent — records per-epoch reward attribution
 * on-chain by listening to LiquidityVault.RebalanceExecuted and calling
 * RewardSplitter.recordEpoch once per consumed warrant.
 *
 * This is the **production** Treasury agent used by Warrant. It:
 *   1. Subscribes to the on-chain `RebalanceExecuted` event stream via
 *      ethers' filter-based listener API.
 *   2. For each event, computes the (scout, executor, treasury) reward
 *      split from a configurable `SplitPolicy` against the observed
 *      gross fees.
 *   3. Calls `RewardSplitter.recordEpoch` from the Treasury wallet —
 *      only Treasury + LiquidityVault are authorized recorders on
 *      mainnet (RewardSplitter.setRecorder(Treasury) = true at deploy).
 *   4. Enforces the split invariant
 *        scoutReward + executorReward + treasuryReward <= grossFees
 *      BEFORE broadcasting, matching the on-chain invariant so bad
 *      inputs revert client-side instead of wasting gas.
 *
 * Treasury is the **fourth** and final agent role in Warrant's
 * four-wallet separation-of-powers model. Giving it its own wallet
 * means a compromise of any of Owner / Scout / Executor / Treasury
 * keys has a bounded blast radius.
 *
 * ### Usage
 *
 *   ```ts
 *   const treasury = new TreasuryAgent({
 *     signer,                                   // ethers.Wallet or JsonRpcSigner
 *     rewardSplitterAddress: manifest.rewardSplitter,
 *     liquidityVaultAddress: manifest.liquidityVault,
 *     splitPolicy: { scoutBps: 3000, executorBps: 3000, treasuryBps: 4000 },
 *   });
 *
 *   // Option A — one-shot settle (used by happy-path script)
 *   await treasury.settleEpochOnchain({ proofId, grossFees: 1_000_000n });
 *
 *   // Option B — long-running daemon
 *   const stop = await treasury.watchAndSettle({
 *     observedGrossFees: (event) => computeFeesFromEvent(event),
 *   });
 *   // ...
 *   stop(); // unsubscribe
 *   ```
 */

import {
  Contract,
  type EventLog,
  type Log,
  type Signer,
  type TransactionReceipt,
} from "ethers";

const REWARD_SPLITTER_ABI = [
  "function recordEpoch(uint256 grossFees, uint256 scoutReward, uint256 executorReward, uint256 treasuryReward, bytes32 proofId) external returns (uint256)",
  "function nextEpochId() view returns (uint256)",
  "function proofAlreadyRecorded(bytes32 proofId) view returns (bool)",
] as const;

const LIQUIDITY_VAULT_EVENT_ABI = [
  "event RebalanceExecuted(uint256 indexed vaultId, bytes32 indexed proofId, bytes32 executionHash, address pool, int24 lowerTick, int24 upperTick, int256 liquidityDelta, address recipient)",
] as const;

/**
 * Reward split expressed in basis points (10_000 = 100%). The sum MUST be
 * <= 10_000. Gross fees not allocated to any agent stay in the vault.
 */
export type SplitPolicy = {
  scoutBps: number;
  executorBps: number;
  treasuryBps: number;
};

export type RewardSplit = {
  scoutReward: bigint;
  executorReward: bigint;
  treasuryReward: bigint;
  retained: bigint;
};

export type SettleEpochInput = {
  proofId: string;
  grossFees: bigint;
  /** Optional override — defaults to the policy passed at construction. */
  policy?: SplitPolicy;
};

export type EpochSettlement = {
  epochId: string;
  txHash: string;
  blockNumber: number;
  grossFees: string;
  split: RewardSplit;
  proofId: string;
};

export type TreasuryAgentConfig = {
  signer: Signer;
  rewardSplitterAddress: string;
  liquidityVaultAddress?: string;
  splitPolicy: SplitPolicy;
  agentId?: string;
};

export type RebalanceExecutedEvent = {
  vaultId: bigint;
  proofId: string;
  executionHash: string;
  pool: string;
  lowerTick: number;
  upperTick: number;
  liquidityDelta: string;
  recipient: string;
  txHash: string;
  blockNumber: number;
};

const BPS_DENOMINATOR = 10_000;

/**
 * Validate a SplitPolicy and throw if the sum exceeds 10_000 bps. Doing
 * this at agent construction means bad policies fail fast instead of at
 * the first tx broadcast.
 */
function assertPolicyInvariant(policy: SplitPolicy): void {
  if (policy.scoutBps < 0 || policy.executorBps < 0 || policy.treasuryBps < 0) {
    throw new Error(`SplitPolicy basis points must be non-negative.`);
  }
  const total = policy.scoutBps + policy.executorBps + policy.treasuryBps;
  if (total > BPS_DENOMINATOR) {
    throw new Error(
      `SplitPolicy exceeds 100%: ${policy.scoutBps}+${policy.executorBps}+${policy.treasuryBps} = ${total} bps (max ${BPS_DENOMINATOR}).`,
    );
  }
}

export class TreasuryAgent {
  private readonly splitter: Contract;
  private readonly vault?: Contract;

  constructor(private readonly config: TreasuryAgentConfig) {
    assertPolicyInvariant(config.splitPolicy);
    this.splitter = new Contract(
      config.rewardSplitterAddress,
      REWARD_SPLITTER_ABI,
      config.signer,
    );
    if (config.liquidityVaultAddress) {
      this.vault = new Contract(
        config.liquidityVaultAddress,
        LIQUIDITY_VAULT_EVENT_ABI,
        config.signer,
      );
    }
  }

  get agentId(): string {
    return this.config.agentId ?? "treasury-agent";
  }

  /**
   * Pure split computation using basis-point arithmetic. Integer math
   * ensures the on-chain invariant holds for every call path — no
   * rounding drift between TS and Solidity.
   */
  computeSplit(grossFees: bigint, policy: SplitPolicy = this.config.splitPolicy): RewardSplit {
    assertPolicyInvariant(policy);
    const scoutReward = (grossFees * BigInt(policy.scoutBps)) / BigInt(BPS_DENOMINATOR);
    const executorReward =
      (grossFees * BigInt(policy.executorBps)) / BigInt(BPS_DENOMINATOR);
    const treasuryReward =
      (grossFees * BigInt(policy.treasuryBps)) / BigInt(BPS_DENOMINATOR);
    const retained = grossFees - scoutReward - executorReward - treasuryReward;
    return { scoutReward, executorReward, treasuryReward, retained };
  }

  /**
   * Has this proof already been settled on-chain? Cheap view call; use
   * before settling to avoid a guaranteed revert.
   */
  async isAlreadySettled(proofId: string): Promise<boolean> {
    return (await this.splitter.proofAlreadyRecorded(proofId)) as boolean;
  }

  /**
   * Broadcast a RewardSplitter.recordEpoch tx. The caller (Treasury
   * wallet) must be an authorized recorder; otherwise the tx reverts
   * with "Not authorized recorder".
   */
  async settleEpochOnchain(input: SettleEpochInput): Promise<EpochSettlement> {
    const policy = input.policy ?? this.config.splitPolicy;
    const split = this.computeSplit(input.grossFees, policy);

    // Client-side mirror of the on-chain invariant — fail-fast.
    const distributed = split.scoutReward + split.executorReward + split.treasuryReward;
    if (distributed > input.grossFees) {
      throw new Error(
        `Split exceeds grossFees: distributed=${distributed}, grossFees=${input.grossFees}.`,
      );
    }

    // Pre-flight idempotency check — prevents a guaranteed revert.
    if (await this.isAlreadySettled(input.proofId)) {
      throw new Error(`Proof ${input.proofId} has already been settled.`);
    }

    const tx = await this.splitter.recordEpoch(
      input.grossFees,
      split.scoutReward,
      split.executorReward,
      split.treasuryReward,
      input.proofId,
    );
    const receipt = (await tx.wait()) as TransactionReceipt;

    // Read nextEpochId AFTER the tx lands so the returned epochId matches
    // what the contract actually allocated. Subtract 1 because nextEpochId
    // is the NEXT free slot, not the just-assigned one.
    const nextEpochId = (await this.splitter.nextEpochId()) as bigint;
    const epochId = (nextEpochId - 1n).toString();

    return {
      epochId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      grossFees: input.grossFees.toString(),
      split,
      proofId: input.proofId,
    };
  }

  /**
   * Subscribe to RebalanceExecuted events on the configured vault and
   * invoke a caller-provided `observedGrossFees` to derive the gross
   * fees for each event. When fees > 0, call settleEpochOnchain.
   *
   * Returns an `unsubscribe` function — call it to stop the listener.
   *
   * The vault address must be provided at agent construction; throws
   * otherwise.
   */
  async watchAndSettle(options: {
    observedGrossFees: (event: RebalanceExecutedEvent) => bigint | Promise<bigint>;
    /** Fires after every settlement attempt (success or failure). */
    onSettled?: (result: { ok: true; settlement: EpochSettlement } | { ok: false; error: string; proofId: string }) => void;
  }): Promise<() => void> {
    if (!this.vault) {
      throw new Error(
        `TreasuryAgent: watchAndSettle requires liquidityVaultAddress at construction.`,
      );
    }
    const vault = this.vault;

    // ethers v6 listener signature for an event defined in ABI: the
    // last arg is the EventLog, preceded by the decoded indexed + data
    // args. We narrow with a type guard and pull from `.args`.
    const listener = async (...listenerArgs: unknown[]) => {
      const raw = listenerArgs[listenerArgs.length - 1] as Log | EventLog;
      if (!("args" in raw) || !raw.args) {
        return; // Not a decoded EventLog — ignore.
      }
      const args = raw.args as unknown as {
        vaultId: bigint;
        proofId: string;
        executionHash: string;
        pool: string;
        lowerTick: bigint;
        upperTick: bigint;
        liquidityDelta: bigint;
        recipient: string;
      };

      const event: RebalanceExecutedEvent = {
        vaultId: args.vaultId,
        proofId: args.proofId,
        executionHash: args.executionHash,
        pool: args.pool,
        lowerTick: Number(args.lowerTick),
        upperTick: Number(args.upperTick),
        liquidityDelta: args.liquidityDelta.toString(),
        recipient: args.recipient,
        txHash: raw.transactionHash,
        blockNumber: raw.blockNumber,
      };

      try {
        const grossFees = await options.observedGrossFees(event);
        if (grossFees <= 0n) {
          options.onSettled?.({
            ok: false,
            error: "grossFees<=0 — skipped settlement",
            proofId: event.proofId,
          });
          return;
        }
        const settlement = await this.settleEpochOnchain({
          proofId: event.proofId,
          grossFees,
        });
        options.onSettled?.({ ok: true, settlement });
      } catch (error) {
        options.onSettled?.({
          ok: false,
          error: error instanceof Error ? error.message : "unknown settlement error",
          proofId: event.proofId,
        });
      }
    };

    await vault.on("RebalanceExecuted", listener);
    return () => {
      void vault.off("RebalanceExecuted", listener);
    };
  }

  /**
   * Structured explanation of a settlement — useful for logging and
   * surfacing to UI.
   */
  explainSettlement(settlement: EpochSettlement) {
    const { split } = settlement;
    return {
      agentId: this.agentId,
      summary:
        `Epoch ${settlement.epochId} recorded at block ${settlement.blockNumber}. ` +
        `Gross fees: ${settlement.grossFees}. ` +
        `Split: scout=${split.scoutReward}, executor=${split.executorReward}, ` +
        `treasury=${split.treasuryReward}, retained=${split.retained}.`,
      settlement,
    };
  }
}
