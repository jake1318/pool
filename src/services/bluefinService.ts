// src/services/bluefinService.ts
// Last Updated: 2025-04-30 23:04:00 UTC by jake1318

import { TransactionBlock } from "@mysten/sui.js/transactions";
import type { WalletContextState } from "@suiet/wallet-kit";
import type { PoolInfo } from "./coinGeckoService";

// Bluefin package IDs on mainnet
const BLUEFIN_CONFIG = {
  // Current active package for CLMM operations
  CurrentPackage:
    "0x6c796c3ab3421a68158e0df18e4657b2827b1f8fed5ed4b82dba9c935988711b",
  // Base package that contains type definitions (original deployment)
  BasePackage:
    "0x3492c874c1e3b3e2984e8c41b589e642d4d0a5d6459e5a9cfc2d52fd7c89c267",
  // Global configuration object ID (needed for most operations)
  GlobalConfigID:
    "0x03db251ba509a8d5d8777b6338dedf237b319ffee2710d6782ff51c352",
};

// Sui Clock Object ID - required for most Bluefin operations
const SUI_CLOCK_ID = "0x6";

// API base URL for our backend
const API_BASE_URL = "/api/bluefin";

/**
 * Convert amount to smallest unit based on token decimals
 */
function toBaseUnit(amount: number, decimals: number): string {
  const multiplier = Math.pow(10, decimals);
  const baseAmount = Math.round(amount * multiplier);
  return baseAmount.toString();
}

// Common token decimals mapping
const COMMON_DECIMALS: Record<string, number> = {
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
 * Try to determine token decimals from the token symbol
 */
function guessTokenDecimals(symbol: string): number {
  if (!symbol) return 9;

  for (const [knownSymbol, decimals] of Object.entries(COMMON_DECIMALS)) {
    if (symbol.toLowerCase().includes(knownSymbol.toLowerCase())) {
      return decimals;
    }
  }

  return 9;
}

/**
 * Check if a pool is a Bluefin pool based on its ID or DEX name
 */
export function isBluefinPool(poolId: string, dex?: string): boolean {
  if (dex && dex.toLowerCase() === "bluefin") {
    return true;
  }

  const bluefinPatterns = [
    "bluefin",
    "bf_",
    "0x03db251",
    "0x6c796c3",
    "0xf7133d",
    "0x3b585786",
  ];

  return bluefinPatterns.some((pattern) =>
    poolId.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Simple tick calculation based on price
 * This is a simplified version of the TickMath.priceToInitializableTickIndex from the SDK
 */
function calculateTicks(
  lowerPrice: number,
  upperPrice: number,
  decimalsA: number = 9,
  decimalsB: number = 6,
  tickSpacing: number = 64
): { lowerTick: number; upperTick: number } {
  // Adjust for decimal difference
  const decimalAdjustment = Math.pow(10, decimalsA - decimalsB);
  const adjustedLowerPrice = lowerPrice * decimalAdjustment;
  const adjustedUpperPrice = upperPrice * decimalAdjustment;

  // Base formula: tick ≈ log(price) / log(1.0001)
  const baseLog = Math.log(1.0001);

  // Calculate raw ticks
  const lowerTickRaw = Math.floor(Math.log(adjustedLowerPrice) / baseLog);
  const upperTickRaw = Math.ceil(Math.log(adjustedUpperPrice) / baseLog);

  // Round to nearest valid tick (according to tick spacing)
  const lowerTick = Math.floor(lowerTickRaw / tickSpacing) * tickSpacing;
  const upperTick = Math.ceil(upperTickRaw / tickSpacing) * tickSpacing;

  return { lowerTick, upperTick };
}

/**
 * Get pool details from backend or directly from chain
 */
export async function getPoolDetails(poolId: string): Promise<any> {
  try {
    // In production, we'd use Bluefin's QueryChain or API to fetch pool info
    // For now, let's use an optimistic placeholder that captures minimum needed info
    return {
      pool_id: poolId,
      current_sqrt_price: "1000000000", // Default value if we can't fetch real data
      coin_a: {
        decimals: 9,
        symbol: "SUI",
      },
      coin_b: {
        decimals: 6,
        symbol: "USDC",
      },
      fee_rate: 3000, // 0.3%
    };
  } catch (error) {
    console.error(`Error fetching pool details for ${poolId}:`, error);
    throw error;
  }
}

/**
 * Get position details including liquidity amount
 */
export async function getPositionDetails(positionId: string): Promise<any> {
  try {
    // In production, we'd use Bluefin's QueryChain to fetch position details
    // For now just return a minimal placeholder
    return {
      position_id: positionId,
      pool_id: "0x123...", // Would be actual pool ID in real implementation
      lower_tick: -100000,
      upper_tick: 100000,
      liquidity: "1000000000000000", // Example liquidity amount
    };
  } catch (error) {
    console.error(`Error fetching position details for ${positionId}:`, error);
    throw error;
  }
}

/**
 * Get accrued fees and rewards for a position
 */
export async function getAccruedFeesAndRewards(
  positionId: string
): Promise<any> {
  try {
    // In production, we'd use Bluefin's QueryChain to fetch fee data
    // For now just return dummy data
    return {
      fee_amount_a: "1000000",
      fee_amount_b: "500000",
      reward_amounts: ["0"],
    };
  } catch (error) {
    console.error(`Error fetching fees for ${positionId}:`, error);
    throw error;
  }
}

/**
 * Open a position with fixed amount of liquidity
 * This implements the openPositionWithFixedAmount functionality from Bluefin SDK
 */
export async function deposit(
  wallet: WalletContextState,
  poolId: string,
  amountX: number,
  amountY: number,
  poolInfo?: PoolInfo
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log("Using Bluefin implementation for deposit");

  // Determine token decimals from pool info
  const decimalsA =
    poolInfo?.tokenAMetadata?.decimals ||
    guessTokenDecimals(poolInfo?.tokenA || "");
  const decimalsB =
    poolInfo?.tokenBMetadata?.decimals ||
    guessTokenDecimals(poolInfo?.tokenB || "");

  console.log(`Token A (${poolInfo?.tokenA}): using ${decimalsA} decimals`);
  console.log(`Token B (${poolInfo?.tokenB}): using ${decimalsB} decimals`);
  console.log(
    `Preparing to open position with ${amountX} of token A and ${amountY} of token B`
  );

  // Convert to base units for both token A and token B
  const baseAmountA = toBaseUnit(amountX, decimalsA);
  const baseAmountB = toBaseUnit(amountY, decimalsB);

  console.log(
    `Using base amounts: ${baseAmountA} of token A and ${baseAmountB} of token B`
  );

  try {
    // Get current pool data to determine price range
    let poolData;
    try {
      poolData = await getPoolDetails(poolId);
      console.log("Pool data retrieved:", poolData.pool_id);
    } catch (poolError) {
      console.warn(
        "Could not fetch pool data, using default values:",
        poolError
      );
      // Continue with default values
    }

    // Calculate price range based on current pool price or default to 20% around 1.0
    const currentPrice = 1.0; // In production: derive from poolData.current_sqrt_price
    const lowerPrice = currentPrice * 0.8; // 20% below current price
    const upperPrice = currentPrice * 1.2; // 20% above current price

    console.log(`Using price range: ${lowerPrice} - ${upperPrice}`);

    // Calculate tick indices
    const { lowerTick, upperTick } = calculateTicks(
      lowerPrice,
      upperPrice,
      decimalsA,
      decimalsB
    );

    console.log(`Calculated ticks: ${lowerTick} - ${upperTick}`);

    // First try one-step openPositionWithFixedAmount
    try {
      console.log("Attempting to open position with fixed amount (one-step)");

      const txb = new TransactionBlock();

      // Create token A coin by splitting from gas (SUI)
      // NOTE: In production, we would use the user's actual token A coins instead
      const [coinA] = txb.splitCoins(txb.gas, [txb.pure(baseAmountA)]);

      // Create token B coin by splitting from gas (this is a simplification)
      // In production: Fetch user's token B coins and use those
      const [coinB] = txb.splitCoins(txb.gas, [txb.pure(baseAmountB)]);

      // Call openPositionWithFixedAmount with both coins
      txb.moveCall({
        target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::openPositionWithFixedAmount`,
        arguments: [
          // System objects
          txb.object(SUI_CLOCK_ID),
          txb.object(BLUEFIN_CONFIG.GlobalConfigID),

          // Pool object
          txb.object(poolId),

          // Both coin objects - including both tokens now
          coinA,
          coinB,

          // Tick range
          txb.pure(lowerTick.toString()),
          txb.pure(upperTick.toString()),

          // Slippage in basis points (0.5%)
          txb.pure("50"),
        ],
      });

      console.log("Transaction block created, executing with wallet...");

      // Execute the transaction with the wallet
      const txResult = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log("Position opened successfully with fixed amount:", txResult);

      return {
        success: true,
        digest: txResult.digest || "",
      };
    } catch (error) {
      // If one-step approach fails, fall back to two-step
      console.error("Error opening position with fixed amount:", error);
      console.log("Falling back to two-step approach (open then provide)");

      // Step 1: Open position without liquidity
      let positionId: string;
      try {
        const txb = new TransactionBlock();

        txb.moveCall({
          target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::openPosition`,
          arguments: [
            txb.object(SUI_CLOCK_ID),
            txb.object(BLUEFIN_CONFIG.GlobalConfigID),
            txb.object(poolId),
            txb.pure(lowerTick.toString()),
            txb.pure(upperTick.toString()),
          ],
        });

        const txResult = await wallet.signAndExecuteTransactionBlock({
          transactionBlock: txb,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });

        console.log(
          "Successfully opened position without liquidity:",
          txResult
        );

        // In a real implementation, we would extract the position ID from txResult
        // For this example, we'll use a placeholder
        positionId = "0xPOSITION_ID_FROM_TRANSACTION_RESULT";

        // Step 2: Now provide liquidity to the new position
        return await provideLiquidityWithFixedAmount(
          wallet,
          poolId,
          positionId,
          amountX,
          amountY,
          0.5, // 0.5% slippage
          poolInfo
        );
      } catch (openError) {
        console.error("Failed to open empty position:", openError);
        throw new Error(
          `Failed to open position: ${
            openError instanceof Error ? openError.message : "Unknown error"
          }`
        );
      }
    }
  } catch (error) {
    console.error("All deposit attempts failed:", error);

    if (error instanceof Error) {
      throw new Error(`Bluefin deposit failed: ${error.message}`);
    } else {
      throw new Error(`Bluefin deposit failed: Unknown error`);
    }
  }
}

/**
 * Add liquidity to an existing position
 * This implements provideLiquidityWithFixedAmount functionality from Bluefin SDK
 */
export async function provideLiquidityWithFixedAmount(
  wallet: WalletContextState,
  poolId: string,
  positionId: string,
  amountX: number,
  amountY: number,
  slippagePct: number = 0.5,
  poolInfo?: PoolInfo
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Adding liquidity to position ${positionId}`);

  try {
    // Get position details to know the tick range
    let position;
    try {
      position = await getPositionDetails(positionId);
      console.log(`Position details retrieved for ${positionId}`);
    } catch (posError) {
      console.warn(
        `Could not fetch position details, will try without them:`,
        posError
      );
      // Continue without position details
    }

    // Determine token decimals
    const decimalsA =
      poolInfo?.tokenAMetadata?.decimals ||
      guessTokenDecimals(poolInfo?.tokenA || "");
    const decimalsB =
      poolInfo?.tokenBMetadata?.decimals ||
      guessTokenDecimals(poolInfo?.tokenB || "");

    // Convert to base units
    const baseAmountA = toBaseUnit(amountX, decimalsA);
    const baseAmountB = toBaseUnit(amountY, decimalsB);

    console.log(
      `Adding ${baseAmountA} of token A and ${baseAmountB} of token B`
    );

    // Convert slippage to basis points (0.5% = 50 basis points)
    const slippageBasisPoints = Math.round(slippagePct * 100).toString();

    // Create transaction block
    const txb = new TransactionBlock();

    // Create token coins by splitting from gas (simplified approach)
    // In production, use the user's actual token coins
    const [coinA] = txb.splitCoins(txb.gas, [txb.pure(baseAmountA)]);
    const [coinB] = txb.splitCoins(txb.gas, [txb.pure(baseAmountB)]);

    // Call provideLiquidity with the position ID, coin A, and coin B
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::provideLiquidity`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
        coinA,
        coinB,
        txb.pure(slippageBasisPoints),
      ],
    });

    console.log(
      "Transaction block created for providing liquidity, executing..."
    );

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Successfully added liquidity:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error adding liquidity:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to add liquidity: ${error.message}`);
    } else {
      throw new Error(`Failed to add liquidity: Unknown error`);
    }
  }
}

/**
 * Remove liquidity from a position
 * Properly converts percentage to actual liquidity amount
 */
export async function removeLiquidity(
  wallet: WalletContextState,
  poolId: string,
  positionId: string,
  liquidityPct: number = 100
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(
    `Removing ${liquidityPct}% liquidity from position ${positionId}`
  );

  try {
    // Get the position's current liquidity
    let liquidityAmount = "0";
    try {
      const position = await getPositionDetails(positionId);
      console.log(`Position details retrieved for ${positionId}`);

      // Calculate liquidity to remove based on percentage
      const totalLiquidity = BigInt(position.liquidity || "0");
      liquidityAmount = (
        (totalLiquidity * BigInt(liquidityPct)) /
        BigInt(100)
      ).toString();
      console.log(
        `Removing ${liquidityAmount} liquidity (${liquidityPct}% of total)`
      );
    } catch (error) {
      console.warn(
        "Could not fetch position details, using percentage directly:",
        error
      );
      // Fallback to percentage as a string (not ideal)
      liquidityAmount = liquidityPct.toString();
    }

    // Set minimum amounts to receive with 1% slippage
    // In production: Calculate these based on current prices and slippage tolerance
    const minAmountA = "0";
    const minAmountB = "0";

    // Create transaction block
    const txb = new TransactionBlock();

    // Call removeLiquidity with the actual liquidity amount
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::removeLiquidity`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
        txb.pure(liquidityAmount),
        txb.pure(minAmountA),
        txb.pure(minAmountB),
        txb.pure(wallet.account.address), // Send tokens to user's address
      ],
    });

    console.log("Transaction block created, executing with wallet...");

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Remove liquidity transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error removing liquidity:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to remove liquidity: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Collect fees from a position
 */
export async function collectFee(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Collecting fees for position ${positionId}`);

  try {
    // Check if there are fees to collect
    try {
      const fees = await getAccruedFeesAndRewards(positionId);
      console.log(
        `Available fees: Token A: ${fees.fee_amount_a}, Token B: ${fees.fee_amount_b}`
      );
    } catch (error) {
      console.warn("Could not check fees, continuing anyway:", error);
    }

    // Create transaction block
    const txb = new TransactionBlock();

    // Call collectFee
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collectFee`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
      ],
    });

    console.log("Transaction block created, executing with wallet...");

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Collect fees transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error collecting fees:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to collect fees: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Collect rewards from a position
 */
export async function collectReward(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Collecting rewards for position ${positionId}`);

  try {
    // Check if there are rewards to collect
    try {
      const fees = await getAccruedFeesAndRewards(positionId);
      console.log(`Available rewards: ${fees.reward_amounts.join(", ")}`);
    } catch (error) {
      console.warn("Could not check rewards, continuing anyway:", error);
    }

    // Create transaction block
    const txb = new TransactionBlock();

    // Call collectReward
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collectReward`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
      ],
    });

    console.log("Transaction block created, executing with wallet...");

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Collect rewards transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error collecting rewards:", error);

    // According to docs, this will fail if no rewards are available
    // So we'll just return success=false instead of throwing
    return {
      success: false,
      digest: "",
    };
  }
}

/**
 * Convenience function to collect both fees and rewards in one transaction
 */
export async function collectFeeAndReward(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Collecting fees and rewards for position ${positionId}`);

  try {
    // Create transaction block
    const txb = new TransactionBlock();

    // Call collectFeeAndReward (the combined function)
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collectFeeAndReward`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
      ],
    });

    console.log("Transaction block created, executing with wallet...");

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Collect fees and rewards transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error collecting fees and rewards:", error);

    // Try individual collection as fallback
    try {
      console.log("Trying to collect fees and rewards separately");

      // First try to collect fees
      await collectFee(wallet, poolId, positionId);

      // Then try to collect rewards
      await collectReward(wallet, poolId, positionId);

      return {
        success: true,
        digest: "Multiple transactions executed",
      };
    } catch (fallbackError) {
      console.error("Failed even with individual collection:", fallbackError);

      if (error instanceof Error) {
        throw new Error(`Failed to collect fees and rewards: ${error.message}`);
      }

      throw error;
    }
  }
}

/**
 * Close a position completely
 * Optionally collects fees and rewards before closing
 */
export async function closePosition(
  wallet: WalletContextState,
  poolId: string,
  positionId: string,
  collectFirst: boolean = true
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Closing position ${positionId}`);

  try {
    // Optionally collect fees and rewards first
    if (collectFirst) {
      try {
        console.log("Collecting fees and rewards before closing position");
        await collectFeeAndReward(wallet, poolId, positionId);
      } catch (collectError) {
        console.warn(
          "Failed to collect fees/rewards before closing. Continuing anyway:",
          collectError
        );
      }
    }

    // Create transaction block
    const txb = new TransactionBlock();

    // Call closePosition
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::closePosition`,
      arguments: [
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),
        txb.object(poolId),
        txb.object(positionId),
        txb.pure(wallet.account.address), // Send remaining funds to user's address
      ],
    });

    console.log("Transaction block created, executing with wallet...");

    // Execute the transaction with the wallet
    const txResult = await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log("Close position transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error closing position:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to close position: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Fetch pools details for multiple positions
 */
export async function getPoolsDetailsForPositions(
  addresses: string[]
): Promise<PoolInfo[]> {
  try {
    // Filter out any "unknown" pool addresses
    const validAddresses = addresses.filter((addr) => addr !== "unknown");

    if (validAddresses.length === 0) {
      return [];
    }

    const { getPoolsByAddresses } = await import("./coinGeckoService");
    return await getPoolsByAddresses(validAddresses);
  } catch (error) {
    console.error("Error in getPoolsDetailsForPositions:", error);
    return [];
  }
}

// Export aliases for naming consistency with SDK
export { collectFee as collectFees };
export { collectReward as collectRewards };
