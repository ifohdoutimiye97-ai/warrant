import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import { ContractFactory, JsonRpcProvider, Wallet, type InterfaceAbi } from "ethers";
import { compileContracts } from "./compile-contracts";
import { requireNetwork, X_LAYER_MAINNET } from "../config/networks";
import { UNISWAP_XLAYER_MAINNET, DEFAULT_POOL_ADDRESS } from "../config/uniswap";

type ConsumerAuthorizer = {
  setConsumer: (consumer: string, allowed: boolean) => Promise<{ wait: () => Promise<unknown> }>;
};

type RecorderAuthorizer = {
  setRecorder: (recorder: string, allowed: boolean) => Promise<{ wait: () => Promise<unknown> }>;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value !== ZERO_ADDRESS ? value : undefined;
}

function parseChainId(raw: string) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EXPECTED_CHAIN_ID must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

async function main() {
  const expectedChainId = parseChainId(requiredEnv("EXPECTED_CHAIN_ID"));
  const targetNetwork = requireNetwork(expectedChainId);

  const rpcUrl = requiredEnv("XLAYER_RPC_URL");
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  const executorAddress = requiredEnv("EXECUTOR_ADDRESS");

  // An attestation signer is a separate wallet allowed to sign warrant
  // payloads for AttestationVerifier. Defaults to SCOUT_AGENT_ADDRESS
  // because that is the agent that actually generates proposals.
  const attestationSigner = optionalEnv("ATTESTATION_SIGNER_ADDRESS")
    ?? optionalEnv("SCOUT_AGENT_ADDRESS");

  // If the operator provides an already-deployed verifier contract, use
  // it. Otherwise we deploy our own AttestationVerifier automatically.
  const externalVerifierAddress = optionalEnv("PROOF_SYSTEM_VERIFIER_ADDRESS");
  const allowInsecureProofs =
    (process.env.ALLOW_INSECURE_PROOFS ?? "false").toLowerCase() === "true";

  // ---- MAINNET HARD GUARDS (P0-01) ----
  // Mainnet deployments must NEVER run in insecure demo mode and must
  // have a real verifier wired in — either one the operator supplied,
  // or the AttestationVerifier we auto-deploy on their behalf.
  if (targetNetwork.isMainnet) {
    if (allowInsecureProofs) {
      throw new Error(
        "ALLOW_INSECURE_PROOFS=true is forbidden on X Layer mainnet. " +
          "Set it to false and either provide PROOF_SYSTEM_VERIFIER_ADDRESS " +
          "or let the deploy script auto-deploy AttestationVerifier by setting ATTESTATION_SIGNER_ADDRESS.",
      );
    }
    if (!externalVerifierAddress && !attestationSigner) {
      throw new Error(
        "Mainnet deploy requires either PROOF_SYSTEM_VERIFIER_ADDRESS (existing verifier) " +
          "or ATTESTATION_SIGNER_ADDRESS / SCOUT_AGENT_ADDRESS (auto-deploy AttestationVerifier).",
      );
    }
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const runtimeNetwork = await provider.getNetwork();
  const runtimeChainId = Number(runtimeNetwork.chainId);

  // ---- CHAIN ID GUARD (P0-05) ----
  if (runtimeChainId !== expectedChainId) {
    throw new Error(
      `Chain mismatch: EXPECTED_CHAIN_ID=${expectedChainId} but RPC returned chainId=${runtimeChainId}. ` +
        "Refusing to deploy. Verify XLAYER_RPC_URL and EXPECTED_CHAIN_ID match.",
    );
  }

  const wallet = new Wallet(privateKey, provider);
  console.log(
    `\nDeploying Warrant to ${targetNetwork.name} (chainId ${expectedChainId}) from ${wallet.address}\n`,
  );
  if (allowInsecureProofs) {
    console.warn(
      "[WARNING] ALLOW_INSECURE_PROOFS=true. ProofVerifier will accept any non-empty proof payload. " +
        "This is only safe on testnet for demos.\n",
    );
  }

  const artifacts = await compileContracts();

  const StrategyRegistry = artifacts.StrategyRegistry;
  const ProofVerifier = artifacts.ProofVerifier;
  const LiquidityVault = artifacts.LiquidityVault;
  const RewardSplitter = artifacts.RewardSplitter;
  const AttestationVerifier = artifacts.AttestationVerifier;

  if (!StrategyRegistry || !ProofVerifier || !LiquidityVault || !RewardSplitter || !AttestationVerifier) {
    throw new Error("Expected contract artifacts were not generated.");
  }

  // 1. Decide which verifier to wire into ProofVerifier. If the operator
  //    didn't provide one, deploy AttestationVerifier with the given
  //    signer. This guarantees ProofVerifier never falls back to the
  //    embedded demo-mode path on mainnet.
  let verifierBackend: string;
  let verifierAddressForProofVerifier: string;
  let attestationVerifierAddress: string | undefined;

  if (externalVerifierAddress) {
    verifierBackend = externalVerifierAddress;
    verifierAddressForProofVerifier = externalVerifierAddress;
    console.log(`  Using external verifier       @ ${externalVerifierAddress}`);
  } else if (attestationSigner) {
    const deployedVerifier = await new ContractFactory(
      AttestationVerifier.abi as InterfaceAbi,
      AttestationVerifier.bytecode,
      wallet,
    ).deploy(attestationSigner);
    await deployedVerifier.waitForDeployment();
    attestationVerifierAddress = await deployedVerifier.getAddress();
    verifierAddressForProofVerifier = attestationVerifierAddress;
    verifierBackend = `AttestationVerifier(${attestationSigner})`;
    console.log(`  AttestationVerifier           @ ${attestationVerifierAddress}`);
    console.log(`  Authorized signer             @ ${attestationSigner}`);
  } else {
    verifierAddressForProofVerifier = ZERO_ADDRESS;
    verifierBackend = "embedded-demo-mode";
    console.log("  [DEMO] No verifier supplied — ProofVerifier will run in insecure demo mode.");
  }

  // 2. StrategyRegistry
  const strategyRegistry = await new ContractFactory(
    StrategyRegistry.abi as InterfaceAbi,
    StrategyRegistry.bytecode,
    wallet,
  ).deploy();
  await strategyRegistry.waitForDeployment();
  const strategyRegistryAddress = await strategyRegistry.getAddress();
  console.log(`  StrategyRegistry              @ ${strategyRegistryAddress}`);

  // 3. ProofVerifier — requires StrategyRegistry for existence checks
  //    and a verifier backend for the actual proof validation.
  const proofVerifier = await new ContractFactory(
    ProofVerifier.abi as InterfaceAbi,
    ProofVerifier.bytecode,
    wallet,
  ).deploy(verifierAddressForProofVerifier, strategyRegistryAddress, allowInsecureProofs);
  await proofVerifier.waitForDeployment();
  const proofVerifierAddress = await proofVerifier.getAddress();
  console.log(`  ProofVerifier                 @ ${proofVerifierAddress}`);

  // 4. LiquidityVault
  const liquidityVault = await new ContractFactory(
    LiquidityVault.abi as InterfaceAbi,
    LiquidityVault.bytecode,
    wallet,
  ).deploy(strategyRegistryAddress, proofVerifierAddress, executorAddress);
  await liquidityVault.waitForDeployment();
  const liquidityVaultAddress = await liquidityVault.getAddress();
  console.log(`  LiquidityVault                @ ${liquidityVaultAddress}`);

  // 5. RewardSplitter
  const rewardSplitter = await new ContractFactory(
    RewardSplitter.abi as InterfaceAbi,
    RewardSplitter.bytecode,
    wallet,
  ).deploy();
  await rewardSplitter.waitForDeployment();
  const rewardSplitterAddress = await rewardSplitter.getAddress();
  console.log(`  RewardSplitter                @ ${rewardSplitterAddress}`);

  // Wiring
  // The vault is the only caller allowed to burn daily slots and consume proofs.
  console.log("\nWiring permissions...");
  await (
    await (strategyRegistry as unknown as ConsumerAuthorizer).setConsumer(liquidityVaultAddress, true)
  ).wait();
  console.log("  StrategyRegistry.setConsumer(vault)");
  await (
    await (proofVerifier as unknown as ConsumerAuthorizer).setConsumer(liquidityVaultAddress, true)
  ).wait();
  console.log("  ProofVerifier.setConsumer(vault)");

  // Vault is the default reward recorder; treasury agent is additional.
  await (
    await (rewardSplitter as unknown as RecorderAuthorizer).setRecorder(liquidityVaultAddress, true)
  ).wait();
  console.log("  RewardSplitter.setRecorder(vault)");
  const treasuryAgentAddress = optionalEnv("TREASURY_AGENT_ADDRESS");
  if (treasuryAgentAddress) {
    await (
      await (rewardSplitter as unknown as RecorderAuthorizer).setRecorder(treasuryAgentAddress, true)
    ).wait();
    console.log(`  RewardSplitter.setRecorder(treasury=${treasuryAgentAddress})`);
  }

  const uniswap = targetNetwork.isMainnet
    ? {
        v3Factory: UNISWAP_XLAYER_MAINNET.v3Factory,
        swapRouter02: UNISWAP_XLAYER_MAINNET.swapRouter02,
        nonfungiblePositionManager: UNISWAP_XLAYER_MAINNET.nonfungiblePositionManager,
        quoterV2: UNISWAP_XLAYER_MAINNET.quoterV2,
        defaultPool: DEFAULT_POOL_ADDRESS,
      }
    : undefined;

  const deployment = {
    network: targetNetwork.name,
    chainId: expectedChainId,
    deployer: wallet.address,
    rpc: rpcUrl,
    blockExplorer: targetNetwork.blockExplorer,
    strategyRegistry: strategyRegistryAddress,
    proofVerifier: proofVerifierAddress,
    attestationVerifier: attestationVerifierAddress ?? externalVerifierAddress ?? null,
    liquidityVault: liquidityVaultAddress,
    rewardSplitter: rewardSplitterAddress,
    uniswap,
    ownerWallet: wallet.address,
    scoutAgentWallet: optionalEnv("SCOUT_AGENT_ADDRESS") ?? "TBD_AFTER_DEPLOYMENT",
    executorAgentWallet: executorAddress,
    treasuryAgentWallet: treasuryAgentAddress ?? "TBD_AFTER_DEPLOYMENT",
    attestationSigner: attestationSigner ?? null,
    verifierBackend,
    insecureProofs: allowInsecureProofs,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(process.cwd(), "deployments");
  await mkdir(deploymentsDir, { recursive: true });
  await writeFile(
    path.join(deploymentsDir, `xlayer-${expectedChainId}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8",
  );

  console.log("\nDeployment complete:");
  console.log(JSON.stringify(deployment, null, 2));

  if (!targetNetwork.isMainnet) {
    console.log(
      `\n[NOTE] Deployed to ${targetNetwork.name}. To promote to ${X_LAYER_MAINNET.name}, rerun with ` +
        `EXPECTED_CHAIN_ID=${X_LAYER_MAINNET.chainId}, ATTESTATION_SIGNER_ADDRESS set, and ALLOW_INSECURE_PROOFS=false.`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
