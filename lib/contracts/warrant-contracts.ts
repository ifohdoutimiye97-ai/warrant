/**
 * Inlined ABIs for the Warrant contracts used by the client side.
 * Keeping this file free of Node-only imports lets strategy-studio and
 * other "use client" components import it directly without hitting the
 * `node:fs/promises` snag that killed the first Vercel build.
 */

export const STRATEGY_REGISTRY_CLIENT_ABI = [
  "function createStrategy(address allowedPool, uint64 maxRebalancesPerDay, uint8 riskLevel, bytes32 metadataHash) external returns (uint256)",
  "function ownerOf(uint256 strategyId) external view returns (address)",
  "function remainingRebalancesToday(uint256 strategyId) external view returns (uint64)",
  "function strategies(uint256 strategyId) view returns (address owner, address allowedPool, uint64 maxRebalancesPerDay, uint64 rebalanceCountToday, uint8 riskLevel, bool active, bytes32 metadataHash, uint40 updatedAt, uint40 windowStart)",
] as const;

export const LIQUIDITY_VAULT_CLIENT_ABI = [
  "function createVault(address baseToken, address quoteToken, uint256 strategyId) external returns (uint256)",
  "function executeRebalance(uint256 vaultId, bytes32 proofId, (address pool, int24 lowerTick, int24 upperTick, int256 liquidityDelta, address recipient) action) external",
  "function vaults(uint256 vaultId) view returns (address owner, address baseToken, address quoteToken, uint256 strategyId, bool active)",
] as const;

export const PROOF_VERIFIER_CLIENT_ABI = [
  "function submitProof(bytes32 proofId, uint256 strategyId, bytes32 proposalHash, bytes32 executionHash, bytes32[] publicInputs, bytes proofData) external returns (bool)",
  "function isVerified(bytes32 proofId) external view returns (bool)",
  "function getProofRecord(bytes32 proofId) external view returns (tuple(uint256 strategyId, bytes32 proposalHash, bytes32 executionHash, bytes32 publicInputsHash, address prover, uint40 submittedAt, bool verified, bool consumed))",
] as const;
