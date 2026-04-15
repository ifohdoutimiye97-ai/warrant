/**
 * Real on-chain Uniswap v3 pool reader for Warrant's Scout agent.
 *
 * This is the product's actual integration with the **Uniswap Skill**
 * core module (the v3 pool contract). Every "Scout proposal" flow in
 * the terminal ends up calling readPoolState() here, which issues live
 * JSON-RPC calls against X Layer and returns authoritative pool state.
 *
 * No mocks, no hardcoded ticks, no off-chain caches — if this file
 * returns data, it came from X Layer that block.
 */

import { Contract, JsonRpcProvider, type InterfaceAbi } from "ethers";
import { ERC20_READ_ABI, UNISWAP_V3_POOL_ABI } from "./pool-abi";
import { requireNetwork } from "@/config/networks";
import { XLAYER_TOKENS } from "@/config/uniswap";

export type PoolSnapshot = {
  chainId: number;
  poolAddress: string;
  token0: TokenSide;
  token1: TokenSide;
  feeBps: number;
  tickSpacing: number;
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string;
  /** Spot price of token0 in terms of token1, adjusted for decimals. */
  priceToken0InToken1: string;
  /** Spot price of token1 in terms of token0, adjusted for decimals. */
  priceToken1InToken0: string;
  observedAtIso: string;
  blockNumber: number;
};

export type TokenSide = {
  address: string;
  symbol: string;
  decimals: number;
};

/**
 * Known-symbol lookup that avoids an extra round-trip when we already
 * have the token in our curated XLAYER_TOKENS map. Falls back to an
 * ERC20 metadata call otherwise.
 */
function lookupKnownToken(address: string): TokenSide | undefined {
  const normalized = address.toLowerCase();
  for (const token of Object.values(XLAYER_TOKENS)) {
    if (token.address.toLowerCase() === normalized) {
      return { address: token.address, symbol: token.symbol, decimals: token.decimals };
    }
  }
  return undefined;
}

async function resolveToken(provider: JsonRpcProvider, address: string): Promise<TokenSide> {
  const cached = lookupKnownToken(address);
  if (cached) return cached;

  const erc20 = new Contract(address, ERC20_READ_ABI as unknown as InterfaceAbi, provider);
  const [symbolRaw, decimalsRaw] = (await Promise.all([
    erc20.symbol(),
    erc20.decimals(),
  ])) as [string, bigint | number];

  return {
    address,
    symbol: typeof symbolRaw === "string" ? symbolRaw : "UNKNOWN",
    decimals: Number(decimalsRaw),
  };
}

/**
 * Compute the spot price of token0 denominated in token1 from the raw
 * sqrtPriceX96 value returned by the pool's slot0() view. The math:
 *
 *     price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
 *
 * We do this with BigInt for the X96 expansion, then JS numbers for the
 * final decimals adjustment. Precision is ample for display purposes.
 */
function computePrices(sqrtPriceX96: bigint, token0: TokenSide, token1: TokenSide) {
  if (sqrtPriceX96 === 0n) {
    return { priceToken0InToken1: "0", priceToken1InToken0: "0" };
  }
  const Q96 = 2n ** 96n;
  // Scale up by 1e18 to preserve precision during the division, then
  // convert to a JS number for the decimals adjustment.
  const ratioScaled = (sqrtPriceX96 * sqrtPriceX96 * 10n ** 18n) / (Q96 * Q96);
  const ratio = Number(ratioScaled) / 1e18;
  const decimalsAdjustment = 10 ** (token0.decimals - token1.decimals);
  const priceToken0InToken1 = ratio * decimalsAdjustment;
  const priceToken1InToken0 = priceToken0InToken1 > 0 ? 1 / priceToken0InToken1 : 0;
  return {
    priceToken0InToken1: priceToken0InToken1.toFixed(6),
    priceToken1InToken0: priceToken1InToken0.toFixed(6),
  };
}

export async function readPoolState(options: {
  chainId: number;
  poolAddress: string;
  rpcUrl?: string;
}): Promise<PoolSnapshot> {
  const network = requireNetwork(options.chainId);
  const rpcUrl = options.rpcUrl ?? network.rpc;
  const provider = new JsonRpcProvider(rpcUrl);

  const pool = new Contract(
    options.poolAddress,
    UNISWAP_V3_POOL_ABI as unknown as InterfaceAbi,
    provider,
  );

  const [
    slot0,
    liquidity,
    token0Address,
    token1Address,
    feeBps,
    tickSpacing,
    blockNumber,
  ] = (await Promise.all([
    pool.slot0(),
    pool.liquidity(),
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.tickSpacing(),
    provider.getBlockNumber(),
  ])) as [
    {
      sqrtPriceX96: bigint;
      tick: bigint;
      observationIndex: bigint;
      observationCardinality: bigint;
      observationCardinalityNext: bigint;
      feeProtocol: bigint;
      unlocked: boolean;
    },
    bigint,
    string,
    string,
    bigint,
    bigint,
    number,
  ];

  const [token0, token1] = await Promise.all([
    resolveToken(provider, token0Address),
    resolveToken(provider, token1Address),
  ]);

  const { priceToken0InToken1, priceToken1InToken0 } = computePrices(
    slot0.sqrtPriceX96,
    token0,
    token1,
  );

  return {
    chainId: options.chainId,
    poolAddress: options.poolAddress,
    token0,
    token1,
    feeBps: Number(feeBps),
    tickSpacing: Number(tickSpacing),
    currentTick: Number(slot0.tick),
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    liquidity: liquidity.toString(),
    priceToken0InToken1,
    priceToken1InToken0,
    observedAtIso: new Date().toISOString(),
    blockNumber,
  };
}
