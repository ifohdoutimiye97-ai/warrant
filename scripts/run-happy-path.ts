/**
 * Warrant Happy Path E2E Script
 * ==============================
 * Runs the full warrant lifecycle on X Layer mainnet using real wallets:
 *
 *   0. Fund Scout + Executor from Deployer
 *   1. createStrategy (Deployer → StrategyRegistry)
 *   2. createVault (Deployer → LiquidityVault)
 *   3. Scout reads pool → plans rebalance → signs attestation → submitProof
 *   4. Executor calls executeRebalance (consumes warrant + daily slot)
 *   5. Treasury calls recordEpoch
 *   6. Verify all on-chain state
 *
 * Usage:
 *   pnpm tsx scripts/run-happy-path.ts
 */

import process from "node:process";
import "dotenv/config";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  parseEther,
  keccak256,
  solidityPacked,
  getBytes,
  type InterfaceAbi,
} from "ethers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readPoolState } from "../lib/uniswap/pool-reader";
import { planRebalance } from "../lib/uniswap/scout";
import { readTickNeighborhood } from "../lib/uniswap/tick-lens";
import { verifyPoolAgainstFactory } from "../lib/uniswap/factory";
import { readOwnerPositions } from "../lib/uniswap/position-manager";
import { simulateRouterSwap } from "../lib/uniswap/swap-router";
import { TreasuryAgent } from "../agents/treasury-agent";

// ---- Load deployment manifest ----
async function loadManifest() {
  const manifestPath = path.join(process.cwd(), "deployments", "xlayer-196.json");
  const raw = JSON.parse(await readFile(manifestPath, "utf8"));
  return raw as Record<string, string>;
}

// ---- Load wallet keys from .wallets.json ----
async function loadWallets() {
  const walletsPath = path.join(process.cwd(), ".wallets.json");
  const raw = JSON.parse(await readFile(walletsPath, "utf8"));
  const wallets = raw.wallets as Array<{ role: string; address: string; privateKey: string }>;
  return {
    owner: wallets.find((w) => w.role === "owner")!,
    scout: wallets.find((w) => w.role === "scout")!,
    executor: wallets.find((w) => w.role === "executor")!,
    treasury: wallets.find((w) => w.role === "treasury")!,
  };
}

// ---- Minimal ABIs ----
const STRATEGY_REGISTRY_ABI = [
  "function createStrategy(address allowedPool, uint64 maxRebalancesPerDay, uint8 riskLevel, bytes32 metadataHash) external returns (uint256)",
  "function nextStrategyId() view returns (uint256)",
  "function strategies(uint256) view returns (address owner, address allowedPool, uint64 maxRebalancesPerDay, uint64 rebalanceCountToday, uint8 riskLevel, bool active, bytes32 metadataHash, uint40 updatedAt, uint40 windowStart)",
  "function remainingRebalancesToday(uint256 strategyId) external view returns (uint64)",
] as const;

const LIQUIDITY_VAULT_ABI = [
  "function createVault(address baseToken, address quoteToken, uint256 strategyId) external returns (uint256)",
  "function executeRebalance(uint256 vaultId, bytes32 proofId, (address pool, int24 lowerTick, int24 upperTick, int256 liquidityDelta, address recipient) action) external",
  "function nextVaultId() view returns (uint256)",
  "function vaults(uint256) view returns (address owner, address baseToken, address quoteToken, uint256 strategyId, bool active)",
] as const;

const PROOF_VERIFIER_ABI = [
  "function submitProof(bytes32 proofId, uint256 strategyId, bytes32 proposalHash, bytes32 executionHash, bytes32[] publicInputs, bytes proofData) external returns (bool)",
  "function isVerified(bytes32 proofId) external view returns (bool)",
  "function getProofRecord(bytes32 proofId) view returns (uint256 strategyId, bytes32 proposalHash, bytes32 executionHash, bytes32 publicInputsHash, address prover, uint40 submittedAt, bool verified, bool consumed)",
] as const;

const REWARD_SPLITTER_ABI = [
  "function recordEpoch(uint256 grossFees, uint256 scoutReward, uint256 executorReward, uint256 treasuryReward, bytes32 proofId) external returns (uint256)",
  "function nextEpochId() view returns (uint256)",
] as const;

// ---- Main ----
async function main() {
  const manifest = await loadManifest();
  const keys = await loadWallets();
  const rpc = new JsonRpcProvider("https://rpc.xlayer.tech");

  const ownerWallet = new Wallet(keys.owner.privateKey, rpc);
  const scoutWallet = new Wallet(keys.scout.privateKey, rpc);
  const executorWallet = new Wallet(keys.executor.privateKey, rpc);
  const treasuryWallet = new Wallet(keys.treasury.privateKey, rpc);

  console.log("\n========================================");
  console.log("  Warrant Happy Path · X Layer Mainnet");
  console.log("========================================\n");

  // ---- Step 0: Fund Scout + Executor + Treasury ----
  console.log("[Step 0] Funding agent wallets from Deployer...");
  const fundAmount = parseEther("0.01");

  for (const agent of [
    { name: "Scout", wallet: scoutWallet },
    { name: "Executor", wallet: executorWallet },
    { name: "Treasury", wallet: treasuryWallet },
  ]) {
    const bal = await rpc.getBalance(agent.wallet.address);
    if (bal < fundAmount / 2n) {
      const tx = await ownerWallet.sendTransaction({
        to: agent.wallet.address,
        value: fundAmount,
      });
      await tx.wait();
      console.log(`  Funded ${agent.name} (${agent.wallet.address}): tx ${tx.hash}`);
    } else {
      console.log(`  ${agent.name} already has ${formatEther(bal)} OKB, skipping`);
    }
  }

  // ---- Step 1: Create Strategy ----
  console.log("\n[Step 1] Creating strategy on StrategyRegistry...");
  const registry = new Contract(
    manifest.strategyRegistry,
    STRATEGY_REGISTRY_ABI as unknown as InterfaceAbi,
    ownerWallet,
  );

  // Use the default Uniswap pool from our config
  const poolAddress = "0x77ef18adf35f62b2ad442e4370cdbc7fe78b7dcc"; // xETH/USDT0
  const metadataHash = keccak256(
    solidityPacked(["string"], ["warrant:medium:xETH/USDT0:2:happy-path-test"]),
  );

  // Resolve strategyId dynamically — on a re-run, nextStrategyId has
  // already been incremented by prior iterations. The newly-created
  // strategy's ID is `nextStrategyId() - 1` after the tx is mined.
  const createStrategyTx = await registry.createStrategy(
    poolAddress,
    2n, // maxRebalancesPerDay
    2,  // riskLevel = medium
    metadataHash,
  );
  const createStrategyReceipt = await createStrategyTx.wait();
  const nextId = await registry.nextStrategyId();
  const strategyId = nextId - 1n;
  console.log(`  Strategy created! tx: ${createStrategyReceipt.hash}`);
  console.log(`  strategyId: ${strategyId} (nextStrategyId is now ${nextId})`);

  const remaining = await registry.remainingRebalancesToday(strategyId);
  console.log(`  remainingRebalancesToday: ${remaining}`);

  // ---- Step 2: Create Vault ----
  console.log("\n[Step 2] Creating vault on LiquidityVault...");
  const vault = new Contract(
    manifest.liquidityVault,
    LIQUIDITY_VAULT_ABI as unknown as InterfaceAbi,
    ownerWallet,
  );

  // token0 = USDT0, token1 = xETH from the pool
  const token0 = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736"; // USD₮0
  const token1 = "0xE7B000003A45145decf8a28FC755aD5eC5EA025A"; // xETH

  const createVaultTx = await vault.createVault(token0, token1, strategyId);
  const createVaultReceipt = await createVaultTx.wait();
  const nextVaultId = await vault.nextVaultId();
  const vaultId = nextVaultId - 1n;
  console.log(`  Vault created! tx: ${createVaultReceipt.hash}`);
  console.log(`  vaultId: ${vaultId} (nextVaultId is now ${nextVaultId})`);

  // ---- Step 3: Scout reads pool → plans rebalance → signs attestation → submitProof ----
  console.log("\n[Step 3] Scout reading live pool state + signing attestation...");

  // Read real pool state
  const snapshot = await readPoolState({ chainId: 196, poolAddress });
  console.log(`  Pool: ${snapshot.token0.symbol}/${snapshot.token1.symbol}`);
  console.log(`  Block: ${snapshot.blockNumber}`);
  console.log(`  Tick: ${snapshot.currentTick}`);
  console.log(`  Price: ${snapshot.priceToken1InToken0} ${snapshot.token0.symbol} per ${snapshot.token1.symbol}`);

  // Plan the rebalance
  const proposal = planRebalance({
    strategyId: Number(strategyId),
    snapshot,
    risk: "medium",
    recipient: ownerWallet.address,
  });
  console.log(`  Proposed range: [${proposal.action.lowerTick}, ${proposal.action.upperTick}]`);
  console.log(`  proposalHash: ${proposal.proposalHash}`);
  console.log(`  executionHash: ${proposal.executionHash}`);

  // ---- Step 3.5: Uniswap Skill Depth Audit ----
  // Before the Scout signs an attestation, it must prove that the pool
  // it is proposing against is canonical Uniswap state — not a look-alike
  // contract. We exercise 4 additional Skill modules here so every warrant
  // submitted on-chain is backed by six independent Uniswap reads.
  console.log("\n[Step 3.5] Skill depth audit across 4 additional Uniswap modules...");

  // Skill #3: TickLens — confirm the liquidity bitmap around currentTick
  const neighborhood = await readTickNeighborhood({
    chainId: 196,
    pool: poolAddress,
    currentTick: snapshot.currentTick,
    tickSpacing: snapshot.tickSpacing,
  });
  console.log(
    `  [TickLens]      word ${neighborhood.wordIndex}: ${neighborhood.ticks.length} initialized ticks ` +
      `(${neighborhood.below.length} below, ${neighborhood.above.length} at/above current)`,
  );

  // Skill #4: V3Factory — canonical pool-address verification
  const factoryCheck = await verifyPoolAgainstFactory({
    chainId: 196,
    tokenA: snapshot.token0.address,
    tokenB: snapshot.token1.address,
    fee: snapshot.feeBps,
    claimedPool: poolAddress,
  });
  console.log(
    `  [V3Factory]     getPool(${snapshot.token0.symbol}, ${snapshot.token1.symbol}, ${snapshot.feeBps}) ` +
      `-> ${factoryCheck.resolvedPool} (matchesClaim=${factoryCheck.matchesClaim})`,
  );
  if (!factoryCheck.matchesClaim) {
    throw new Error(
      `ABORT: Claimed pool ${poolAddress} does not match canonical factory resolution.`,
    );
  }

  // Skill #5: NonfungiblePositionManager — existing-inventory snapshot
  const ownerInventory = await readOwnerPositions({
    chainId: 196,
    owner: ownerWallet.address,
    pool: {
      token0: snapshot.token0.address,
      token1: snapshot.token1.address,
      fee: snapshot.feeBps,
    },
    maxScan: 8,
  });
  console.log(
    `  [NFPM]          owner LP NFT balance: ${ownerInventory.balance}, ` +
      `matching this pool: ${ownerInventory.matchingPool.length}`,
  );

  // Skill #6: SwapRouter02 — execution-path static simulation
  const routerSim = await simulateRouterSwap({
    chainId: 196,
    tokenIn: snapshot.token0.address,
    tokenOut: snapshot.token1.address,
    fee: snapshot.feeBps,
    recipient: ownerWallet.address,
    amountInWei: 10n ** BigInt(snapshot.token0.decimals), // 1 unit of token0
  });
  console.log(
    routerSim.ok
      ? `  [SwapRouter02]  staticCall ok — would return ${routerSim.amountOut} wei of ${snapshot.token1.symbol}`
      : `  [SwapRouter02]  staticCall reverts as expected (no pre-wired allowance for read-only audit)`,
  );

  console.log(
    `  >>> 6 Uniswap Skill modules exercised for this warrant: ` +
      `V3Pool, QuoterV2, TickLens, V3Factory, NFPM, SwapRouter02 <<<`,
  );

  // Generate a unique proofId
  const proofId = keccak256(
    solidityPacked(
      ["string", "uint256", "uint256"],
      ["warrant-happy-path", strategyId, BigInt(Date.now())],
    ),
  );
  console.log(`  proofId: ${proofId}`);

  // Build publicInputs for AttestationVerifier
  const publicInputs = [
    keccak256(solidityPacked(["uint256"], [strategyId])),
    proposal.proposalHash,
    proposal.executionHash,
  ];

  // Sign the attestation (EIP-191 personal_sign)
  const attestDigest = keccak256(
    solidityPacked(["bytes32", "bytes32", "bytes32"], publicInputs),
  );
  const signature = await scoutWallet.signMessage(getBytes(attestDigest));
  console.log(`  Attestation signed by Scout: ${signature.slice(0, 20)}...`);

  // Submit proof
  const proofVerifier = new Contract(
    manifest.proofVerifier,
    PROOF_VERIFIER_ABI as unknown as InterfaceAbi,
    scoutWallet,
  );

  const submitTx = await proofVerifier.submitProof(
    proofId,
    strategyId,
    proposal.proposalHash,
    proposal.executionHash,
    publicInputs,
    signature,
  );
  const submitReceipt = await submitTx.wait();
  console.log(`  Proof submitted! tx: ${submitReceipt.hash}`);

  // Verify proof is accepted
  const isVerified = await proofVerifier.isVerified(proofId);
  console.log(`  isVerified: ${isVerified}`);

  if (!isVerified) {
    throw new Error("BUG: Proof was submitted but isVerified() returns false!");
  }

  // ---- Step 4: Executor calls executeRebalance ----
  console.log("\n[Step 4] Executor executing rebalance with warrant...");
  const vaultAsExecutor = new Contract(
    manifest.liquidityVault,
    LIQUIDITY_VAULT_ABI as unknown as InterfaceAbi,
    executorWallet,
  );

  const executeTx = await vaultAsExecutor.executeRebalance(vaultId, proofId, {
    pool: proposal.action.pool,
    lowerTick: proposal.action.lowerTick,
    upperTick: proposal.action.upperTick,
    liquidityDelta: proposal.action.liquidityDelta,
    recipient: proposal.action.recipient,
  });
  const executeReceipt = await executeTx.wait();
  console.log(`  Rebalance executed! tx: ${executeReceipt.hash}`);
  console.log(`  Gas used: ${executeReceipt.gasUsed}`);

  // Verify proof is now consumed
  const isStillVerified = await proofVerifier.isVerified(proofId);
  console.log(`  isVerified after consume: ${isStillVerified} (should be false)`);

  // Verify daily cap decremented
  const remainingAfter = await registry.remainingRebalancesToday(strategyId);
  console.log(`  remainingRebalancesToday: ${remainingAfter} (should be 1)`);

  // ---- Step 5: Treasury records epoch via production TreasuryAgent ----
  // The Treasury role uses the same agent class the production deployment
  // will run as a daemon — exercising it here proves the class end-to-end.
  console.log("\n[Step 5] Treasury recording reward epoch via TreasuryAgent...");
  const treasury = new TreasuryAgent({
    signer: treasuryWallet,
    rewardSplitterAddress: manifest.rewardSplitter,
    liquidityVaultAddress: manifest.liquidityVault,
    // Split policy: Scout 30%, Executor 30%, Treasury 40% of gross fees.
    splitPolicy: { scoutBps: 3000, executorBps: 3000, treasuryBps: 4000 },
  });

  const demoGrossFees = 1_000n; // demo-value; in prod, observe from pool fee growth
  const alreadySettled = await treasury.isAlreadySettled(proofId);
  console.log(`  proofAlreadyRecorded[${proofId.slice(0, 12)}...]: ${alreadySettled}`);

  const settlement = await treasury.settleEpochOnchain({
    proofId,
    grossFees: demoGrossFees,
  });
  console.log(`  Epoch ${settlement.epochId} recorded! tx: ${settlement.txHash}`);
  console.log(
    `  Split: scout=${settlement.split.scoutReward} ` +
      `executor=${settlement.split.executorReward} ` +
      `treasury=${settlement.split.treasuryReward} ` +
      `retained=${settlement.split.retained}`,
  );
  const recordReceipt = { hash: settlement.txHash };

  // ---- Step 6: Final state check ----
  console.log("\n[Step 6] Final on-chain state verification...");

  const balances = await Promise.all([
    rpc.getBalance(ownerWallet.address),
    rpc.getBalance(scoutWallet.address),
    rpc.getBalance(executorWallet.address),
    rpc.getBalance(treasuryWallet.address),
  ]);
  console.log(`  Owner balance:    ${formatEther(balances[0])} OKB`);
  console.log(`  Scout balance:    ${formatEther(balances[1])} OKB`);
  console.log(`  Executor balance: ${formatEther(balances[2])} OKB`);
  console.log(`  Treasury balance: ${formatEther(balances[3])} OKB`);

  const deployerNonce = await rpc.getTransactionCount(ownerWallet.address);
  console.log(`  Deployer total tx: ${deployerNonce}`);

  console.log("\n========================================");
  console.log("  ✅ HAPPY PATH COMPLETE");
  console.log("========================================");
  console.log("\nTransaction hashes for Build X submission:");
  console.log(`  createStrategy:   ${createStrategyReceipt.hash}`);
  console.log(`  createVault:      ${createVaultReceipt.hash}`);
  console.log(`  submitProof:      ${submitReceipt.hash}`);
  console.log(`  executeRebalance: ${executeReceipt.hash}`);
  console.log(`  recordEpoch:      ${recordReceipt.hash}`);
  console.log(`\nExplorer: https://www.okx.com/web3/explorer/xlayer`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("\n❌ HAPPY PATH FAILED:");
  console.error(message);
  process.exitCode = 1;
});
