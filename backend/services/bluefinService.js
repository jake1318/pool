// backend/services/bluefinService.js
const { SuiClient } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const {
  OnChainCalls,
  QueryChain,
  TickMath,
  ClmmPoolUtil,
} = require("@firefly-exchange/library-sui/dist/src/spot");
const BN = require("bn.js");
const Decimal = require("decimal.js");

// Bluefin mainnet configuration
const BLUEFIN_CONFIG = {
  GlobalConfig: "0x03db251ba509a8d5d8777b6338dedf237b319ffee2710d6782ff51c352",
  ProtocolFeeCap: "0x55697473304e901372020f30d9feffce83295d2",
  Display: "0x5f34ee74e113d74ae9546695a23c6725d54ab",
  AdminCap: "0xc5e736b21175e1f8121d58b74afeba8d8b9",
  UpgradeCap: "0xd5b2d2159a78030e6f07e028eb502079c0d",
  Publisher: "0xd9810c5d1ec5d13eac8a70a05bb17767",
  BasePackage: "0x3492c874c1e3b3e2984e8c41bd7c89c267",
  CurrentPackage: "0x6c796c3ab3421a68158e0df18988711b",
};

// Initialize Bluefin client
const client = new SuiClient({
  url: process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
});
const qc = new QueryChain(client);

// Common token decimals mapping
const COMMON_DECIMALS = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  BTC: 8,
  ETH: 8,
  WETH: 8,
  CETUS: 9,
  BLUE: 9,
  DEEP: 8,
};

/**
 * Helper function to guess token decimals based on symbol
 */
function guessTokenDecimals(symbol) {
  if (!symbol) return 9;

  // Default fallbacks by token name
  for (const [knownSymbol, decimals] of Object.entries(COMMON_DECIMALS)) {
    if (symbol.toLowerCase().includes(knownSymbol.toLowerCase())) {
      return decimals;
    }
  }

  // Default fallback
  return 9;
}

/**
 * Convert amount to smallest unit based on token decimals
 */
function toBaseUnit(amount, decimals) {
  const multiplier = Math.pow(10, decimals);
  const baseAmount = Math.round(amount * multiplier);
  return baseAmount.toString();
}

/**
 * Get pool information
 */
async function getPool(poolId) {
  try {
    const pool = await qc.getPool(poolId);
    return pool;
  } catch (error) {
    console.error("Error getting pool:", error);
    throw new Error(`Failed to get pool: ${error.message}`);
  }
}

/**
 * Get all available pools (paginated)
 */
async function getPools(limit = 50, offset = 0) {
  try {
    // Note: This is a placeholder. The actual implementation would depend on
    // how Bluefin's API exposes this functionality.
    const pools = await qc.getPools(limit, offset);
    return pools;
  } catch (error) {
    console.error("Error getting pools:", error);
    throw new Error(`Failed to get pools: ${error.message}`);
  }
}

/**
 * Get user's positions
 */
async function getUserPositions(address) {
  try {
    const positions = await qc.getUserPositions(address);
    return positions;
  } catch (error) {
    console.error(`Error getting positions for ${address}:`, error);
    throw new Error(`Failed to get positions: ${error.message}`);
  }
}

/**
 * Get position details
 */
async function getPositionDetails(positionId) {
  try {
    const position = await qc.getPositionDetails(positionId);
    return position;
  } catch (error) {
    console.error(`Error getting details for position ${positionId}:`, error);
    throw new Error(`Failed to get position details: ${error.message}`);
  }
}

/**
 * Prepare add liquidity transaction payload
 */
async function prepareAddLiquidity(
  poolId,
  amountA,
  amountB,
  decimalsA,
  decimalsB
) {
  try {
    // Get pool information
    const pool = await getPool(poolId);

    // Convert to base units
    const baseAmountA = toBaseUnit(amountA, decimalsA);
    const baseAmountB = toBaseUnit(amountB, decimalsB);

    // Create a transaction block for constructing the transaction
    const txb = new TransactionBlock();

    // Get the current price and pool ticks
    const currentSqrtPrice = pool.current_sqrt_price;
    const tickSpacing = pool.ticks_manager.tick_spacing;

    // Calculate price range (20% range around current price as an example)
    const currentPrice = new Decimal(pool.current_price);
    const lowerPrice = currentPrice.mul(0.9).toString(); // 10% below current price
    const upperPrice = currentPrice.mul(1.1).toString(); // 10% above current price

    // Calculate tick indices
    const lowerTick = TickMath.priceToInitializableTickIndex(
      new Decimal(lowerPrice),
      decimalsA,
      decimalsB,
      tickSpacing
    );

    const upperTick = TickMath.priceToInitializableTickIndex(
      new Decimal(upperPrice),
      decimalsA,
      decimalsB,
      tickSpacing
    );

    // Prepare the transaction payload
    const txPayload = {
      kind: "moveCall",
      target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::add_full_range_liquidity`,
      arguments: [
        { kind: "Input", index: 0 }, // poolId
        { kind: "Input", index: 1 }, // baseAmountA
        { kind: "Input", index: 2 }, // baseAmountB
        { kind: "Input", index: 3 }, // slippage
      ],
      typeArguments: [],
    };

    return {
      txPayload,
      pool,
      baseAmountA,
      baseAmountB,
      lowerTick,
      upperTick,
      currentSqrtPrice,
    };
  } catch (error) {
    console.error("Error preparing add liquidity transaction:", error);
    throw new Error(
      `Failed to prepare add liquidity transaction: ${error.message}`
    );
  }
}

/**
 * Prepare remove liquidity transaction payload
 */
async function prepareRemoveLiquidity(poolId, positionId, liquidityPercent) {
  try {
    // Get position details
    const position = await getPositionDetails(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Get pool details
    const pool = await getPool(poolId);
    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    // Calculate liquidity to remove based on percentage
    const totalLiquidity = BigInt(position.liquidity || "0");
    if (totalLiquidity === 0n) {
      throw new Error("Position has no liquidity");
    }

    const liquidityToRemove =
      (totalLiquidity * BigInt(liquidityPercent)) / BigInt(100);
    const liquidityToRemoveStr = liquidityToRemove.toString();

    // Calculate minimum amounts with 1% slippage
    const slippage = 100; // 1% (in basis points)

    // Prepare the transaction payload
    const txPayload = {
      kind: "moveCall",
      target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::remove_liquidity`,
      arguments: [
        { kind: "Input", index: 0 }, // poolId
        { kind: "Input", index: 1 }, // positionId
        { kind: "Input", index: 2 }, // liquidityToRemove
        { kind: "Input", index: 3 }, // slippage
      ],
      typeArguments: [],
    };

    return {
      txPayload,
      position,
      pool,
      liquidityToRemove: liquidityToRemoveStr,
      slippage,
    };
  } catch (error) {
    console.error("Error preparing remove liquidity transaction:", error);
    throw new Error(
      `Failed to prepare remove liquidity transaction: ${error.message}`
    );
  }
}

/**
 * Prepare collect fees transaction payload
 */
async function prepareCollectFees(poolId, positionId) {
  try {
    // Verify position exists
    const position = await getPositionDetails(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Check if there are fees to collect
    const fees = await qc.getAccruedFeeAndRewards(positionId);

    // Prepare the transaction payload
    const txPayload = {
      kind: "moveCall",
      target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::collect_fees`,
      arguments: [
        { kind: "Input", index: 0 }, // poolId
        { kind: "Input", index: 1 }, // positionId
      ],
      typeArguments: [],
    };

    return {
      txPayload,
      position,
      fees,
    };
  } catch (error) {
    console.error("Error preparing collect fees transaction:", error);
    throw new Error(
      `Failed to prepare collect fees transaction: ${error.message}`
    );
  }
}

/**
 * Prepare close position transaction payload
 */
async function prepareClosePosition(poolId, positionId) {
  try {
    // Verify position exists
    const position = await getPositionDetails(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Prepare the transaction payload
    const txPayload = {
      kind: "moveCall",
      target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::close_position`,
      arguments: [
        { kind: "Input", index: 0 }, // poolId
        { kind: "Input", index: 1 }, // positionId
      ],
      typeArguments: [],
    };

    return {
      txPayload,
      position,
    };
  } catch (error) {
    console.error("Error preparing close position transaction:", error);
    throw new Error(
      `Failed to prepare close position transaction: ${error.message}`
    );
  }
}

module.exports = {
  getPool,
  getPools,
  getUserPositions,
  getPositionDetails,
  prepareAddLiquidity,
  prepareRemoveLiquidity,
  prepareCollectFees,
  prepareClosePosition,
  guessTokenDecimals,
  toBaseUnit,
};
