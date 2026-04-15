/**
 * Warrant Uniswap Skill integration #5: NonfungiblePositionManager.
 *
 * Reads the canonical Uniswap v3 NFPM (0x315e413a...) to answer two
 * questions the Scout agent cares about before proposing a rebalance:
 *
 *   1. How many LP NFTs does the owner (or vault recipient) currently
 *      hold? (balanceOf)
 *   2. For a given tokenId, what is the exact position state —
 *      (tickLower, tickUpper, liquidity, tokensOwed0, tokensOwed1)?
 *      (positions)
 *
 * This is how Warrant verifies that the rebalance it is about to
 * propose either opens a NEW range (if the recipient has no active
 * position) or modifies an EXISTING one (if they do). Without this
 * read, the Scout would be flying blind about what the vault actually
 * holds.
 *
 * The NFPM is a CORE Uniswap v3 periphery contract — distinct from
 * UniswapV3Pool, QuoterV2, TickLens, and V3Factory. Counting it as a
 * separate Skill module is faithful to the Uniswap surface.
 */

import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import { requireNetwork } from "@/config/networks";
import { UNISWAP_XLAYER_MAINNET } from "@/config/uniswap";

const NFPM_READ_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function factory() external view returns (address)",
] as const;

export type PositionSnapshot = {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
};

export type OwnerPositionInventory = {
  manager: string;
  owner: string;
  balance: number;
  positions: PositionSnapshot[];
  /**
   * Positions filtered down to those matching the pool's token pair
   * and fee. Usually the meaningful set for a specific strategy.
   */
  matchingPool: PositionSnapshot[];
};

/**
 * Iterate the owner's full LP NFT balance and return every position
 * plus the filtered subset that matches the target pool's (token0,
 * token1, fee). Bounded by `maxScan` to avoid unbounded loops on
 * whales.
 */
export async function readOwnerPositions(params: {
  chainId: number;
  rpcUrl?: string;
  owner: string;
  pool: { token0: string; token1: string; fee: number };
  maxScan?: number;
}): Promise<OwnerPositionInventory> {
  const network = requireNetwork(params.chainId);
  const rpcUrl = params.rpcUrl ?? network.rpc;
  const provider = new JsonRpcProvider(rpcUrl);

  const nfpm = new Contract(
    UNISWAP_XLAYER_MAINNET.nonfungiblePositionManager,
    NFPM_READ_ABI as unknown as InterfaceAbi,
    provider,
  );

  const balanceBig = (await nfpm.balanceOf(params.owner)) as bigint;
  const balance = Number(balanceBig);
  const cap = Math.min(balance, params.maxScan ?? 16);

  const ownedIds: string[] = [];
  for (let i = 0; i < cap; i++) {
    try {
      const id = (await nfpm.tokenOfOwnerByIndex(params.owner, i)) as bigint;
      ownedIds.push(id.toString());
    } catch {
      break;
    }
  }

  const positions: PositionSnapshot[] = [];
  for (const tokenId of ownedIds) {
    try {
      const raw = (await nfpm.positions(tokenId)) as {
        nonce: bigint;
        operator: string;
        token0: string;
        token1: string;
        fee: bigint;
        tickLower: bigint;
        tickUpper: bigint;
        liquidity: bigint;
        feeGrowthInside0LastX128: bigint;
        feeGrowthInside1LastX128: bigint;
        tokensOwed0: bigint;
        tokensOwed1: bigint;
      };
      positions.push({
        tokenId,
        token0: raw.token0,
        token1: raw.token1,
        fee: Number(raw.fee),
        tickLower: Number(raw.tickLower),
        tickUpper: Number(raw.tickUpper),
        liquidity: raw.liquidity.toString(),
        tokensOwed0: raw.tokensOwed0.toString(),
        tokensOwed1: raw.tokensOwed1.toString(),
      });
    } catch {
      // Skip positions that revert — e.g. burned NFTs in some edge cases.
    }
  }

  const t0 = params.pool.token0.toLowerCase();
  const t1 = params.pool.token1.toLowerCase();
  const matchingPool = positions.filter(
    (p) =>
      p.fee === params.pool.fee &&
      p.token0.toLowerCase() === t0 &&
      p.token1.toLowerCase() === t1,
  );

  return {
    manager: UNISWAP_XLAYER_MAINNET.nonfungiblePositionManager,
    owner: params.owner,
    balance,
    positions,
    matchingPool,
  };
}
