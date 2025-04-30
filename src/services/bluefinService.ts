// src/services/bluefinService.ts
// Last Updated: 2025-04-30 02:00:15 UTC by jake1318

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
  // This would need to be fetched from Bluefin's API or directly from the chain
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
 * Open a position and deposit liquidity in a Bluefin pool
 * For a production app, we'd want to first check if the position exists
 * and either open it or add liquidity
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
      `Preparing add liquidity for ${amountX} of token A and ${amountY} of token B`
    );

    // Convert to base units
    const baseAmountA = toBaseUnit(amountX, decimalsA);
    const baseAmountB = toBaseUnit(amountY, decimalsB);

    console.log(
      `Using base amounts: ${baseAmountA} of token A and ${baseAmountB} of token B`
    );

    // For a simplified implementation, we'll use provide_liquidity_with_fixed_amount
    // which is more suitable for our direct use case
    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);
    console.log(
      `Using module: pool and function: provide_liquidity_with_fixed_amount`
    );

    // Create transaction block
    const txb = new TransactionBlock();

    // In a production app, we would:
    // 1. First check if the user already has a position for this pool
    // 2. If not, open a position using open_position_with_fixed_amount
    // 3. If yes, use provide_liquidity_with_fixed_amount

    // Since we're focusing on the deposit functionality,
    // we'll use provide_liquidity_with_fixed_amount directly

    // This is a simplified version - in production, you would need:
    // - Clock object (0x6)
    // - GlobalConfig object
    // - Pool object (poolId)
    // - Position object (would need to be fetched or created)
    // - Split coins for the exact amounts

    // For this example, we can't include all those details without more complex setup
    // Let's demonstrate a simple approach by making a move call
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::provide_liquidity_with_fixed_amount`,
      arguments: [
        // In a complete implementation, we would include:
        // - Clock object
        // - GlobalConfig
        // - Pool object
        // - Position object
        // - Coin objects for A and B
        // - Min amounts (for slippage protection)
        // - Recipient address

        // For our simple test, just provide the pool ID and amounts
        txb.pure(poolId),
        txb.pure(baseAmountA),
        txb.pure(baseAmountB),
        txb.pure("50"), // 0.5% slippage (in basis points)
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

    console.log("Bluefin deposit transaction completed:", txResult);

    return {
      success: true,
      digest: txResult.digest || "",
    };
  } catch (error) {
    console.error("Error in Bluefin deposit:", error);

    if (error instanceof Error) {
      throw new Error(`Bluefin deposit failed: ${error.message}`);
    }

    throw new Error(`Bluefin deposit failed: Unknown error`);
  }
}

/**
 * Remove liquidity from a position
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
    // Create a transaction block
    const txb = new TransactionBlock();

    // Calculate liquidity amount based on percentage
    // In a real implementation, you'd first:
    // 1. Get the position's current liquidity
    // 2. Calculate the amount to remove as (current * liquidityPct / 100)
    // For this example, we'll just use the percentage directly

    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);
    console.log(`Using module: pool and function: remove_liquidity`);

    // Call the remove_liquidity function
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::remove_liquidity`,
      arguments: [
        // In a complete implementation, we would include:
        // - Clock object
        // - GlobalConfig
        // - Pool object
        // - Position object
        // - Liquidity amount
        // - Min amounts (for slippage protection)
        // - Recipient address

        // For our simple test, just provide the pool ID, position ID and percentage
        txb.pure(poolId),
        txb.pure(positionId),
        txb.pure(liquidityPct.toString()),
        txb.pure(wallet.account.address), // Destination address
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
    // Create a transaction block
    const txb = new TransactionBlock();

    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);
    console.log(`Using module: pool and function: collect_fee`);

    // Call the collect_fee function
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::collect_fee`,
      arguments: [
        // In a complete implementation, we would include:
        // - Clock object
        // - GlobalConfig
        // - Pool object
        // - Position object

        // For our simple test, just provide the pool ID and position ID
        txb.pure(poolId),
        txb.pure(positionId),
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
export async function collectRewards(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<{ success: boolean; digest: string }> {
  // For Bluefin, we'll use collectFees since that's the primary function
  // In a more complete implementation, we'd also check for reward collection
  return collectFees(wallet, poolId, positionId);
}

/**
 * Close a position completely
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
    // Create a transaction block
    const txb = new TransactionBlock();

    console.log(`Using Bluefin package: ${BLUEFIN_CONFIG.CurrentPackage}`);
    console.log(`Using module: pool and function: close_position`);

    // Call the close_position function
    txb.moveCall({
      target: `${BLUEFIN_CONFIG.CurrentPackage}::pool::close_position`,
      arguments: [
        // In a complete implementation, we would include:
        // - Clock object
        // - GlobalConfig
        // - Pool object
        // - Position object
        // - Destination address

        // For our simple test, just provide the pool ID, position ID, and destination
        txb.pure(poolId),
        txb.pure(positionId),
        txb.pure(wallet.account.address), // Destination address
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
