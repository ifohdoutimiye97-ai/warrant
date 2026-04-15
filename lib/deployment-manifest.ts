import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_NETWORK, getNetwork } from "@/config/networks";
import { isPlaceholder } from "@/lib/manifest-helpers";

export { isPlaceholder };

export type DeploymentManifest = {
  network: string;
  chainId: number;
  rpc: string;
  blockExplorer: string;
  strategyRegistry: string;
  proofVerifier: string;
  attestationVerifier?: string | null;
  liquidityVault: string;
  rewardSplitter: string;
  ownerWallet: string;
  scoutAgentWallet: string;
  executorAgentWallet: string;
  treasuryAgentWallet: string;
  attestationSigner?: string | null;
  uniswap?: {
    v3Factory: string;
    swapRouter02: string;
    nonfungiblePositionManager: string;
    quoterV2: string;
    defaultPool: string;
  };
  deployer?: string;
  deployedAt?: string;
  verifierBackend?: string;
  insecureProofs?: boolean;
  manifestSource?: string;
};

export type ContractEntry = {
  name: string;
  address: string;
  purpose: string;
};

export type AgentEntry = {
  name: string;
  address: string;
  role: string;
};

function deploymentsDir() {
  return path.join(process.cwd(), "deployments");
}

function templatePath() {
  return path.join(deploymentsDir(), "xlayer-template.json");
}

function normalizeManifest(raw: Record<string, unknown>, source: string): DeploymentManifest {
  const chainIdRaw = raw.chainId;
  const parsedChainId =
    typeof chainIdRaw === "number"
      ? chainIdRaw
      : typeof chainIdRaw === "string"
        ? Number(chainIdRaw)
        : DEFAULT_NETWORK.chainId;
  const chainId = Number.isFinite(parsedChainId) ? parsedChainId : DEFAULT_NETWORK.chainId;
  const fallbackNetwork = getNetwork(chainId) ?? DEFAULT_NETWORK;

  const deployer = typeof raw.deployer === "string" ? raw.deployer : undefined;
  const executorAddress =
    typeof raw.executorAddress === "string"
      ? raw.executorAddress
      : typeof raw.executorAgentWallet === "string"
        ? raw.executorAgentWallet
        : "TBD_AFTER_DEPLOYMENT";

  return {
    network: typeof raw.network === "string" ? raw.network : fallbackNetwork.name,
    chainId,
    rpc: typeof raw.rpc === "string" ? raw.rpc : fallbackNetwork.rpc,
    blockExplorer:
      typeof raw.blockExplorer === "string" ? raw.blockExplorer : fallbackNetwork.blockExplorer,
    strategyRegistry:
      typeof raw.strategyRegistry === "string" ? raw.strategyRegistry : "TBD_AFTER_DEPLOYMENT",
    proofVerifier: typeof raw.proofVerifier === "string" ? raw.proofVerifier : "TBD_AFTER_DEPLOYMENT",
    liquidityVault: typeof raw.liquidityVault === "string" ? raw.liquidityVault : "TBD_AFTER_DEPLOYMENT",
    rewardSplitter: typeof raw.rewardSplitter === "string" ? raw.rewardSplitter : "TBD_AFTER_DEPLOYMENT",
    ownerWallet:
      typeof raw.ownerWallet === "string"
        ? raw.ownerWallet
        : deployer ?? "TBD_AFTER_DEPLOYMENT",
    scoutAgentWallet:
      typeof raw.scoutAgentWallet === "string" ? raw.scoutAgentWallet : "TBD_AFTER_DEPLOYMENT",
    executorAgentWallet: executorAddress,
    treasuryAgentWallet:
      typeof raw.treasuryAgentWallet === "string" ? raw.treasuryAgentWallet : "TBD_AFTER_DEPLOYMENT",
    attestationVerifier:
      typeof raw.attestationVerifier === "string" ? raw.attestationVerifier : null,
    attestationSigner:
      typeof raw.attestationSigner === "string" ? raw.attestationSigner : null,
    uniswap:
      raw.uniswap && typeof raw.uniswap === "object"
        ? (raw.uniswap as DeploymentManifest["uniswap"])
        : undefined,
    deployer,
    deployedAt: typeof raw.deployedAt === "string" ? raw.deployedAt : undefined,
    verifierBackend:
      typeof raw.verifierBackend === "string" ? raw.verifierBackend : undefined,
    insecureProofs: typeof raw.insecureProofs === "boolean" ? raw.insecureProofs : undefined,
    manifestSource: source,
  };
}

async function readManifestFile(targetPath: string) {
  const content = await readFile(targetPath, "utf8");
  return JSON.parse(content) as Record<string, unknown>;
}

async function pickLatestLiveManifest() {
  const dir = deploymentsDir();
  const files = await readdir(dir);
  const liveFiles = files.filter(
    (file) => file.startsWith("xlayer-") && file.endsWith(".json") && file !== "xlayer-template.json",
  );

  if (liveFiles.length === 0) {
    return null;
  }

  const withTimes = await Promise.all(
    liveFiles.map(async (file) => {
      const absolutePath = path.join(dir, file);
      const details = await stat(absolutePath);
      return {
        file,
        absolutePath,
        modifiedAt: details.mtimeMs,
      };
    }),
  );

  withTimes.sort((left, right) => right.modifiedAt - left.modifiedAt);
  return withTimes[0] ?? null;
}

export async function getDeploymentStatus() {
  const latest = await pickLatestLiveManifest();

  if (latest) {
    const raw = await readManifestFile(latest.absolutePath);
    return {
      manifest: normalizeManifest(raw, latest.file),
      manifestFile: latest.file,
      hasLiveManifest: true,
    };
  }

  const raw = await readManifestFile(templatePath());
  return {
    manifest: normalizeManifest(raw, "xlayer-template.json"),
    manifestFile: "xlayer-template.json",
    hasLiveManifest: false,
  };
}

export function getContractEntries(manifest: DeploymentManifest): ContractEntry[] {
  const entries: ContractEntry[] = [
    {
      name: "StrategyRegistry",
      address: manifest.strategyRegistry,
      purpose: "Stores owner-declared strategy constraints and enforces a per-UTC-day rebalance budget.",
    },
    {
      name: "ProofVerifier",
      address: manifest.proofVerifier,
      purpose:
        "Binds warrants to (strategyId, proposalHash, executionHash) and exposes the single-use consume gate.",
    },
  ];

  if (manifest.attestationVerifier && !isPlaceholder(manifest.attestationVerifier)) {
    entries.push({
      name: "AttestationVerifier",
      address: manifest.attestationVerifier,
      purpose:
        "ECDSA attestation verifier plugged into ProofVerifier. Accepts warrants signed by the authorized scout wallet.",
    });
  }

  entries.push(
    {
      name: "LiquidityVault",
      address: manifest.liquidityVault,
      purpose:
        "Holds owner capital. Recomputes executionHash on-chain from the RebalanceAction struct before consuming a warrant.",
    },
    {
      name: "RewardSplitter",
      address: manifest.rewardSplitter,
      purpose:
        "Access-controlled epoch recorder. Enforces scoutReward + executorReward + treasuryReward ≤ grossFees.",
    },
  );

  return entries;
}

export function getAgentEntries(manifest: DeploymentManifest): AgentEntry[] {
  return [
    {
      name: "Owner Wallet",
      role: "Creates strategies and owns the vault policy.",
      address: manifest.ownerWallet,
    },
    {
      name: "Scout Agent Wallet",
      role: "Observes pool state and submits proof-backed rebalance proposals.",
      address: manifest.scoutAgentWallet,
    },
    {
      name: "Executor Agent Wallet",
      role: "Verifies proof status and executes vault actions.",
      address: manifest.executorAgentWallet,
    },
    {
      name: "Treasury Agent Wallet",
      role: "Records fee growth and reward epochs for the strategy.",
      address: manifest.treasuryAgentWallet,
    },
  ];
}

export function summarizeManifest(manifest: DeploymentManifest) {
  const contractEntries = getContractEntries(manifest);
  const agentEntries = getAgentEntries(manifest);
  const placeholderCount =
    contractEntries.filter((entry) => isPlaceholder(entry.address)).length +
    agentEntries.filter((entry) => isPlaceholder(entry.address)).length;

  return {
    contractEntries,
    agentEntries,
    placeholderCount,
  };
}
