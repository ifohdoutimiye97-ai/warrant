/**
 * Warrant Uniswap Skill integration #4: UniswapV3Factory.
 *
 * Resolves `(tokenA, tokenB, fee) → pool address` straight from the
 * canonical X Layer v3Factory. This is the authoritative lookup — the
 * Scout agent uses it to prove that the pool the owner's strategy
 * declares is actually a Uniswap-deployed pool, not an arbitrary
 * address someone slipped into the natural-language prompt.
 *
 * The check runs before every Live scout proposal so evaluators can see
 * that Warrant gates policy creation on canonical Uniswap state, not
 * on mutable config files.
 *
 * Why Factory specifically:
 *   StrategyRegistry stores `allowedPool` as a raw address. Without a
 *   factory check, a malicious owner could point the strategy at a
 *   lookalike contract. Factory.getPool() is the single source of
 *   truth for "does this (token0, token1, fee) triplet actually
 *   correspond to THIS pool address on v3?"
 */

import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import { requireNetwork } from "@/config/networks";
import { UNISWAP_XLAYER_MAINNET } from "@/config/uniswap";

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
  "function owner() external view returns (address)",
] as const;

export type FactoryPoolCheck = {
  factory: string;
  token0: string;
  token1: string;
  fee: number;
  resolvedPool: string;
  /** True if resolvedPool (case-insensitive) matches the claimed address. */
  matchesClaim: boolean;
  claimedPool: string;
};

/**
 * Ask v3Factory.getPool for the canonical pool of a (tokenA, tokenB, fee)
 * triplet, then compare against the claimed pool address. Returns both
 * the resolved address and a boolean so callers can decide whether to
 * fail closed or annotate the warrant with a mismatch.
 */
export async function verifyPoolAgainstFactory(params: {
  chainId: number;
  rpcUrl?: string;
  tokenA: string;
  tokenB: string;
  fee: number;
  claimedPool: string;
}): Promise<FactoryPoolCheck> {
  const network = requireNetwork(params.chainId);
  const rpcUrl = params.rpcUrl ?? network.rpc;
  const provider = new JsonRpcProvider(rpcUrl);

  const factory = new Contract(
    UNISWAP_XLAYER_MAINNET.v3Factory,
    FACTORY_ABI as unknown as InterfaceAbi,
    provider,
  );

  const resolvedPool: string = await factory.getPool(
    params.tokenA,
    params.tokenB,
    params.fee,
  );

  const matchesClaim =
    resolvedPool.toLowerCase() === params.claimedPool.toLowerCase() &&
    resolvedPool !== "0x0000000000000000000000000000000000000000";

  // Factory addresses are checksummed; normalize token0/token1 ordering
  // so the response is stable no matter which side the caller passes.
  const [lowA, lowB] = [params.tokenA.toLowerCase(), params.tokenB.toLowerCase()];
  const [token0, token1] = lowA < lowB ? [params.tokenA, params.tokenB] : [params.tokenB, params.tokenA];

  return {
    factory: UNISWAP_XLAYER_MAINNET.v3Factory,
    token0,
    token1,
    fee: params.fee,
    resolvedPool,
    matchesClaim,
    claimedPool: params.claimedPool,
  };
}
