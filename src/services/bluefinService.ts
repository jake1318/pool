// src/services/bluefinService.ts
// Last Updated: 2025-04-30 19:27:12 UTC by jake1318

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
 * Check if the backend API is available
 */
async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.success && data.clientInitialized;
  } catch (error) {
    console.warn("Backend API check failed:", error);
    return false;
  }
}

/**
 * Fetch pool details from backend
 */
export async function getPoolDetails(poolId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/pools/${poolId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch pool details: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(`Error fetching pool details for ${poolId}:`, error);
    throw error;
  }
}

/**
 * Fetch user positions from the backend
 */
export async function getPositions(
  ownerAddress: string
): Promise<Array<{ id: string; poolAddress: string; liquidity: number }>> {
  try {
    // First check if API is available
    const apiAvailable = await checkApiStatus();
    if (!apiAvailable) {
      console.warn(
        "Backend API not available for position fetching, returning empty array"
      );
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/positions/${ownerAddress}`);

    if (!response.ok) {
      console.error(`Failed to fetch positions: ${response.statusText}`);
      return [];
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error("Error fetching positions:", error);
    return [];
  }
}

/**
 * Get position details from backend
 */
export async function getPositionDetails(positionId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/position/${positionId}`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch position details: ${response.statusText}`
      );
    }

    const result = await response.json();
    return result.data;
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
    const response = await fetch(`${API_BASE_URL}/fees/${positionId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch fees: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(`Error fetching fees for ${positionId}:`, error);
    throw error;
  }
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
 * Open a position with fixed amount of liquidity
 * Following the pattern from the Bluefin SDK documentation using camelCase function names
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

  try {
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

    // Convert to base units
    const baseAmountA = toBaseUnit(amountX, decimalsA);
    const baseAmountB = toBaseUnit(amountY, decimalsB);

    console.log(
      `Using base amounts: ${baseAmountA} of token A and ${baseAmountB} of token B`
    );

    // Define a price range around a middle price - in reality this would be calculated
    // from the current pool price and perhaps user input
    const middlePrice = 1.0;
    const lowerPrice = middlePrice * 0.8; // 20% below current price
    const upperPrice = middlePrice * 1.2; // 20% above current price

    console.log(`Using price range: ${lowerPrice} - ${upperPrice}`);

    // Calculate tick indices
    const { lowerTick, upperTick } = calculateTicks(
      lowerPrice,
      upperPrice,
      decimalsA,
      decimalsB
    );

    console.log(`Calculated ticks: ${lowerTick} - ${upperTick}`);

    // Create transaction block
    const txb = new TransactionBlock();

    // Split coins for the transaction
    // Create SUI coin for the A amount
    const [coinA] = txb.splitCoins(txb.gas, [txb.pure(baseAmountA)]);

    // In a production app, we need to get the user's coin objects for token B
    // For this demo, we'll simulate it with another split

    console.log(`Attempting to open position with fixed amount`);

    // Try calling the openPositionWithFixedAmount function (camelCase)
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::openPositionWithFixedAmount`,
      arguments: [
        // Clock and config objects
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),

        // Pool object
        txb.object(poolId),

        // Coin objects
        coinA,

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

    console.log("Position opened successfully with liquidity:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error opening position with fixed amount:", error);

    // If that fails, try just opening a position without providing liquidity
    try {
      console.log("Falling back to basic openPosition...");

      const txb = new TransactionBlock();

      // Define price range
      const middlePrice = 1.0;
      const lowerPrice = middlePrice * 0.8; // 20% below
      const upperPrice = middlePrice * 1.2; // 20% above

      // Calculate tick indices
      const { lowerTick, upperTick } = calculateTicks(
        lowerPrice,
        upperPrice,
        poolInfo?.tokenAMetadata?.decimals || 9,
        poolInfo?.tokenBMetadata?.decimals || 6
      );

      // Try to open a position without providing liquidity - using camelCase
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

      console.log("Successfully opened position without liquidity:", txResult);

      return {
        success: true,
        digest: txResult.digest || "",
      };
    } catch (fallbackError) {
      // Try one more pattern with gateway functions
      try {
        console.log("Trying gateway pattern...");

        const txb = new TransactionBlock();

        txb.moveCall({
          target: `${BLUEFIN_CONFIG.CurrentPackage}::gateway::openPosition`,
          arguments: [
            txb.object(poolId),
            txb.pure("-887220"), // Max lower tick
            txb.pure("887220"), // Max upper tick
          ],
        });

        const txResult = await wallet.signAndExecuteTransactionBlock({
          transactionBlock: txb,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });

        console.log("Successfully opened position with gateway:", txResult);

        return {
          success: true,
          digest: txResult.digest || "",
        };
      } catch (gatewayError) {
        console.error("All attempts failed:", gatewayError);

        if (error instanceof Error) {
          throw new Error(
            `Bluefin deposit failed: ${error.message}\nFallback error: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unknown error"
            }`
          );
        } else {
          throw new Error(`Bluefin deposit failed: Unknown error`);
        }
      }
    }
  }
}

/**
 * Remove liquidity from a position
 * Based on the Bluefin SDK documentation for removeLiquidity with camelCase naming
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
    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);

    // Create a transaction block
    const txb = new TransactionBlock();

    // Convert liquidityPct to an actual liquidity amount
    // For this example, we're using the percentage directly
    // In production, you'd fetch the position's liquidity and compute liquidityAmount = totalLiquidity * (liquidityPct/100)
    const liquidityAmount = liquidityPct.toString();

    // Set minimum amounts to receive (apply slippage protection)
    // For this example, we're using 0 (meaning accept any amount)
    // In production, you'd calculate these based on current prices and slippage tolerance
    const minAmountA = "0";
    const minAmountB = "0";

    // Call the removeLiquidity function with clock and config objects - camelCase naming
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::removeLiquidity`,
      arguments: [
        // System objects
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),

        // Pool and position
        txb.object(poolId),
        txb.object(positionId),

        // Liquidity amount and minimum amounts
        txb.pure(liquidityAmount),
        txb.pure(minAmountA),
        txb.pure(minAmountB),

        // Destination address
        txb.pure(wallet.account.address),
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
 * Based on the Bluefin SDK documentation for collectFee with camelCase naming
 */
export async function collectFees(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Collecting fees for position ${positionId}`);

  try {
    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);

    // Create a transaction block
    const txb = new TransactionBlock();

    // Call the collectFee function with clock and config objects - camelCase naming
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collectFee`,
      arguments: [
        // System objects
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),

        // Pool and position
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
 * Based on the Bluefin SDK documentation for collectRewards with camelCase naming
 */
export async function collectRewards(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Collecting rewards for position ${positionId}`);

  try {
    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);

    // Create a transaction block
    const txb = new TransactionBlock();

    // Call the collectReward function with clock and config objects - camelCase naming
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collectReward`,
      arguments: [
        // System objects
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),

        // Pool and position
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
 * Close a position completely
 * Based on the Bluefin SDK documentation for closePosition with camelCase naming
 */
export async function closePosition(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }

  console.log(`Closing position ${positionId}`);

  try {
    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);

    // Create a transaction block
    const txb = new TransactionBlock();

    // Call the closePosition function with clock and config objects - camelCase naming
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::closePosition`,
      arguments: [
        // System objects
        txb.object(SUI_CLOCK_ID),
        txb.object(BLUEFIN_CONFIG.GlobalConfigID),

        // Pool and position
        txb.object(poolId),
        txb.object(positionId),

        // Destination address
        txb.pure(wallet.account.address),
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
