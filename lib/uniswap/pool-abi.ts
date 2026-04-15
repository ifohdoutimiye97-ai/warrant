/**
 * Minimal Uniswap v3 Pool ABI — only the read-only methods our scout
 * agent needs. Keeping this inline avoids shipping the entire v3 core
 * package to the client bundle.
 *
 * Full contract:
 *   https://github.com/Uniswap/v3-core/blob/main/contracts/UniswapV3Pool.sol
 */
export const UNISWAP_V3_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function tickSpacing() external view returns (int24)",
  "function observe(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
] as const;

export const ERC20_READ_ABI = [
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
] as const;
