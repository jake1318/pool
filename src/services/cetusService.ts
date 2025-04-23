// src/services/cetusService.ts

import {
  initCetusSDK,
  ClmmPoolUtil,
  TickMath,
  Percentage,
  adjustForCoinSlippage,
} from "@cetusprotocol/cetus-sui-clmm-sdk";
import type { WalletContextState } from "@suiet/wallet-kit";
import type { PoolInfo } from "./coinGeckoService";
import BN from "bn.js";

/**
 * Creates a fresh SDK instance bound to a signer address.
 */
function getSdkWithWallet(address: string) {
  const sdk = initCetusSDK({
    network: "mainnet",
    wallet: address,
  });
  sdk.senderAddress = address;
  return sdk;
}

/**
 * Convert amount to smallest unit based on token decimals
 * e.g., 1.5 USDC with 6 decimals becomes 1500000
 */
function toBaseUnit(amount: number, decimals: number): string {
  // Handle potential floating point precision issues
  const multiplier = Math.pow(10, decimals);
  const baseAmount = Math.round(amount * multiplier);
  return baseAmount.toString();
}

/**
 * Show a transaction digest popup with link to SuiVision
 */
function showTransactionPopup(digest: string): void {
  // Create a container for the popup
  const popupContainer = document.createElement("div");
  popupContainer.style.position = "fixed";
  popupContainer.style.bottom = "20px";
  popupContainer.style.right = "20px";
  popupContainer.style.backgroundColor = "#ffffff";
  popupContainer.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  popupContainer.style.borderRadius = "8px";
  popupContainer.style.padding = "15px";
  popupContainer.style.zIndex = "10000";
  popupContainer.style.maxWidth = "400px";
  popupContainer.style.display = "flex";
  popupContainer.style.flexDirection = "column";
  popupContainer.style.gap = "10px";

  // Create a header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("h3");
  title.textContent = "Transaction Submitted";
  title.style.margin = "0";
  title.style.fontSize = "16px";
  title.style.fontWeight = "bold";

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.backgroundColor = "transparent";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "20px";
  closeButton.style.cursor = "pointer";
  closeButton.onclick = () => document.body.removeChild(popupContainer);

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content
  const content = document.createElement("div");

  const digestText = document.createElement("p");
  digestText.textContent = `Digest: ${digest.substring(
    0,
    8
  )}...${digest.substring(digest.length - 8)}`;
  digestText.style.margin = "5px 0";
  digestText.style.fontSize = "14px";

  const link = document.createElement("a");
  link.href = `https://suivision.xyz/txblock/${digest}`;
  link.textContent = "View on SuiVision";
  link.target = "_blank";
  link.style.display = "inline-block";
  link.style.padding = "8px 12px";
  link.style.backgroundColor = "#3b82f6";
  link.style.color = "white";
  link.style.textDecoration = "none";
  link.style.borderRadius = "4px";
  link.style.fontSize = "14px";
  link.style.fontWeight = "medium";

  content.appendChild(digestText);
  content.appendChild(link);

  // Add header and content to popup
  popupContainer.appendChild(header);
  popupContainer.appendChild(content);

  // Add popup to the body
  document.body.appendChild(popupContainer);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.body.contains(popupContainer)) {
      document.body.removeChild(popupContainer);
    }
  }, 10000);
}

// Common token decimals - helps us handle the most common ones
const COMMON_DECIMALS: Record<string, number> = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  BTC: 8,
  ETH: 8,
  WETH: 8,
  CETUS: 9,
};

/**
 * Try to determine token decimals from the type string
 */
function guessTokenDecimals(coinType: string): number {
  // Default fallbacks by token name
  for (const [symbol, decimals] of Object.entries(COMMON_DECIMALS)) {
    if (coinType.toLowerCase().includes(symbol.toLowerCase())) {
      console.log(
        `Guessed ${decimals} decimals for ${coinType} based on symbol ${symbol}`
      );
      return decimals;
    }
  }

  // Default fallback
  console.log(
    `Could not determine decimals for ${coinType}, using default of 9`
  );
  return 9;
}

/** Cleanly extract the raw Move‐object fields for a position NFT */
async function fetchPositionFields(
  sdk: ReturnType<typeof getSdkWithWallet>,
  positionId: string
): Promise<any> {
  try {
    // 1) Try native SDK call
    return await sdk.Position.getPosition(positionId);
  } catch (e) {
    console.log("getPosition failed, trying direct RPC:", e);
    // 2) Fallback: direct RPC
  }
  const resp = await sdk.fullClient.getObject({
    id: positionId,
    options: { showContent: true, showDisplay: true },
  });
  const content = (resp.data as any)?.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`Position ${positionId} not found on‐chain`);
  }
  return content.fields;
}

/**
 * Extract pool ID from position link or other data
 */
function extractPoolIdFromPosition(position: any): string {
  // Try to extract from link field
  if (position.link) {
    try {
      // Example: https://app.cetus.zone/position?chain=sui&id=0x...&pool=0x...
      const url = new URL(position.link);
      const poolParam = url.searchParams.get("pool");
      if (poolParam) {
        return poolParam;
      }
    } catch (e) {
      console.warn("Failed to extract pool ID from link:", e);
    }
  }

  // Try to extract from name field
  if (position.name) {
    try {
      // Example: "Cetus LP | Pool3137-551143"
      const poolMatch = position.name.match(/Pool(\d+)/);
      if (poolMatch && poolMatch[1]) {
        // Not a real pool ID, but can be used to query the actual pool
        return `pool-${poolMatch[1]}`;
      }
    } catch (e) {
      console.warn("Failed to extract pool ID from name:", e);
    }
  }

  // Return empty string if all extraction attempts fail
  return "";
}

/**
 * Open a full‑range position and deposit liquidity.
 */
export async function deposit(
  wallet: WalletContextState,
  poolId: string,
  amountX: number,
  amountY: number
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  // Get pool information
  const pool = await sdk.Pool.getPool(poolId);
  if (!pool) {
    throw new Error("Pool not found");
  }

  // Get token decimals by looking at the coin types
  const decimalsA = guessTokenDecimals(pool.coinTypeA);
  const decimalsB = guessTokenDecimals(pool.coinTypeB);

  console.log(`Token A (${pool.coinTypeA}): using ${decimalsA} decimals`);
  console.log(`Token B (${pool.coinTypeB}): using ${decimalsB} decimals`);

  // Calculate proper tick ranges based on pool's tick spacing
  const tickSpacing = parseInt(pool.tickSpacing);
  const currentTickIndex = parseInt(pool.current_tick_index);

  // Calculate proper tick boundaries that are multiples of tickSpacing
  // Create a position with a range that's 20 ticks on either side of the current tick
  const lowerTickIndex =
    Math.floor((currentTickIndex - tickSpacing * 20) / tickSpacing) *
    tickSpacing;
  const upperTickIndex =
    Math.ceil((currentTickIndex + tickSpacing * 20) / tickSpacing) *
    tickSpacing;

  console.log(
    `Creating position with tick range: ${lowerTickIndex} to ${upperTickIndex}`
  );
  console.log(
    `Pool details: tickSpacing=${tickSpacing}, currentTick=${currentTickIndex}`
  );

  // Convert amounts to base units (smallest denomination)
  const baseAmountA = toBaseUnit(amountX, decimalsA);
  const baseAmountB = toBaseUnit(amountY, decimalsB);

  console.log(
    `Converting amounts: ${amountX} -> ${baseAmountA}, ${amountY} -> ${baseAmountB}`
  );

  // Step 1: Create position
  console.log("Step 1: Creating position");
  const openPositionTx = await sdk.Position.openPositionTransactionPayload({
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: poolId,
    tick_lower: lowerTickIndex.toString(),
    tick_upper: upperTickIndex.toString(),
  });

  console.log("Sending position creation transaction");
  const openPositionRes = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: openPositionTx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
  console.log("Transaction completed, response:", openPositionRes);

  // Show transaction popup for position creation
  if (openPositionRes.digest) {
    showTransactionPopup(openPositionRes.digest);
  }

  // If we only got a digest, try to fetch the full transaction
  if (
    openPositionRes.digest &&
    (!openPositionRes.events || openPositionRes.events.length === 0)
  ) {
    console.log(
      "Only received transaction digest, fetching transaction details"
    );
    try {
      // Wait a moment for transaction to be fully processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fetch transaction details using SDK
      const txDetails = await sdk.fullClient.getTransactionBlock({
        digest: openPositionRes.digest,
        options: {
          showEvents: true,
          showEffects: true,
          showObjectChanges: true,
          showInput: true,
        },
      });

      console.log("Fetched transaction details:", txDetails);

      // Merge transaction details into our response
      if (txDetails.events) openPositionRes.events = txDetails.events;
      if (txDetails.effects)
        (openPositionRes as any).effects = txDetails.effects;
      if (txDetails.objectChanges)
        openPositionRes.objectChanges = txDetails.objectChanges;

      console.log("Updated transaction response:", openPositionRes);
    } catch (error) {
      console.error("Error fetching transaction details:", error);
    }
  }

  // Extract position id with enhanced logging and error handling
  let positionId = null;

  // Look at all effects changes - specifically created objects
  if (
    (openPositionRes as any).effects &&
    (openPositionRes as any).effects.created
  ) {
    console.log(
      "Looking through created objects in effects:",
      (openPositionRes as any).effects.created
    );

    // Find position NFT among created objects
    const createdObjects = (openPositionRes as any).effects.created;
    for (const obj of createdObjects) {
      console.log("Checking created object:", obj);
      if (obj.owner && obj.owner.AddressOwner === address) {
        console.log("Found object owned by caller:", obj);
        positionId = obj.reference.objectId;
        console.log(`Found position ID: ${positionId}`);
        break;
      }
    }
  }

  // If not found in effects, try object changes
  if (!positionId && openPositionRes.objectChanges) {
    console.log(
      "Looking through object changes:",
      openPositionRes.objectChanges
    );

    // Find objects created in this transaction
    const createdObjects = openPositionRes.objectChanges.filter(
      (change) => change.type === "created" || change.type === "published"
    );

    console.log("Created objects:", createdObjects);

    // Find position NFT among created objects (owned by address)
    for (const obj of createdObjects) {
      if (obj.owner && obj.owner === address) {
        positionId = obj.objectId;
        console.log(`Found position ID: ${positionId}`);
        break;
      }
    }

    // If no owner match, use first created object as fallback
    if (!positionId && createdObjects.length > 0) {
      positionId = createdObjects[0].objectId;
      console.log(`Using first created object as position ID: ${positionId}`);
    }
  }

  // Check events as a last resort
  if (
    !positionId &&
    openPositionRes.events &&
    openPositionRes.events.length > 0
  ) {
    console.log("Looking through events:", openPositionRes.events);

    // Try to find position events
    const positionEventPatterns = [
      "::PositionCreated",
      "::PositionOpened",
      "::position::PositionCreated",
      "::position::PositionOpened",
      "::clmm::position::PositionCreated",
      "::clmm::position::PositionOpened",
    ];

    for (const pattern of positionEventPatterns) {
      const evt = openPositionRes.events.find((e) => e.type.endsWith(pattern));
      if (evt && evt.parsedJson) {
        console.log(`Found event matching ${pattern}:`, evt.parsedJson);

        // Try various field names for position id
        const possibleIdFields = [
          "position_id",
          "pos_id",
          "positionId",
          "id",
          "nft_id",
        ];
        for (const field of possibleIdFields) {
          const id = (evt.parsedJson as any)[field];
          if (id) {
            console.log(`Found position ID in field ${field}: ${id}`);
            positionId = id;
            break;
          }
        }

        if (positionId) break;
      }
    }
  }

  if (!positionId) {
    console.error(
      "Transaction successful but could not extract position ID from response"
    );
    console.error("Full response:", JSON.stringify(openPositionRes, null, 2));
    throw new Error("Failed to extract position ID");
  }

  console.log(`Successfully extracted position ID: ${positionId}`);

  // Step 2: Add liquidity to the position
  console.log("Step 2: Adding liquidity to position");

  // Wait a moment before adding liquidity to ensure position is fully created
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Then add liquidity using createAddLiquidityFixTokenPayload
  // Make sure to use the same tick values as when creating the position
  const addLiquidityParams = {
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: poolId,
    tick_lower: lowerTickIndex.toString(),
    tick_upper: upperTickIndex.toString(),
    fix_amount_a: false, // Fix amount B instead of A
    amount_a: baseAmountA,
    amount_b: baseAmountB,
    slippage: 0.05, // 5% slippage
    is_open: false, // Already opened the position
    rewarder_coin_types: [],
    collect_fee: false,
    pos_id: positionId,
  };

  console.log("Adding liquidity with params:", addLiquidityParams);
  const addLiquidityTx = await sdk.Position.createAddLiquidityFixTokenPayload(
    addLiquidityParams,
    {
      slippage: 0.05, // 5% slippage
      curSqrtPrice: pool.current_sqrt_price,
    }
  );

  console.log("Sending add liquidity transaction");
  const addLiquidityRes = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: addLiquidityTx,
    options: {
      showEffects: true,
      showEvents: true,
      showInput: true,
    },
  });
  console.log("Liquidity addition successful");

  // Show transaction popup for liquidity addition
  if (addLiquidityRes.digest) {
    showTransactionPopup(addLiquidityRes.digest);
  }
}

/**
 * Remove a percentage (0–100) of liquidity from a position, collecting fees.
 */
export async function removeLiquidity(
  wallet: WalletContextState,
  poolId: string,
  positionId: string,
  liquidityPct: number = 100
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  // 1) Fetch on‐chain position fields
  const pos = await fetchPositionFields(sdk, positionId);
  if (!pos.liquidity || pos.liquidity === "0") {
    throw new Error("Position has zero liquidity");
  }

  // 2) Resolve actual pool ID
  const actualPoolId = pos.pool_id || pos.pool || poolId;
  if (!actualPoolId) {
    throw new Error("Cannot find pool_id for this position");
  }

  // 3) Fetch on‐chain pool
  const pool = await sdk.Pool.getPool(actualPoolId);
  if (!pool) throw new Error(`Pool ${actualPoolId} not found`);

  // 4) Compute removal amount
  const totalLiq = new BN(pos.liquidity);
  const removeLiq = totalLiq.muln(liquidityPct).divn(100);

  // 5) Compute min amounts with slippage
  const lowerSqrt = TickMath.tickIndexToSqrtPriceX64(pos.tick_lower_index);
  const upperSqrt = TickMath.tickIndexToSqrtPriceX64(pos.tick_upper_index);
  const curSqrt = new BN(pool.current_sqrt_price);

  const coinAmounts = ClmmPoolUtil.getCoinAmountFromLiquidity(
    removeLiq,
    curSqrt,
    lowerSqrt,
    upperSqrt,
    false
  );
  const slippageTol = new Percentage(new BN(5), new BN(100));
  const { tokenMaxA, tokenMaxB } = adjustForCoinSlippage(
    coinAmounts,
    slippageTol,
    false
  );

  // 6) Build & execute tx with pos_id (not position_id!)
  const tx = await sdk.Position.removeLiquidityTransactionPayload({
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: actualPoolId,
    pos_id: positionId, // <-- use pos_id
    delta_liquidity: removeLiq.toString(),
    min_amount_a: tokenMaxA.toString(),
    min_amount_b: tokenMaxB.toString(),
    collect_fee: true,
    rewarder_coin_types: [], // <-- explicitly pass empty array
  });
  const res = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: { showEvents: true, showEffects: true },
  });
  if (res.digest) showTransactionPopup(res.digest);
}

/**
 * Withdraw all liquidity, fees and rewards, and close the position.
 */
export async function closePosition(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  // Fetch pos & pool
  const pos = await fetchPositionFields(sdk, positionId);
  const actualPoolId = pos.pool_id || pos.pool || poolId;
  const pool = await sdk.Pool.getPool(actualPoolId);
  if (!pool) throw new Error(`Pool ${actualPoolId} not found`);

  // Compute slippage amounts
  const totalLiq = new BN(pos.liquidity || "0");
  const lowerSqrt = TickMath.tickIndexToSqrtPriceX64(pos.tick_lower_index);
  const upperSqrt = TickMath.tickIndexToSqrtPriceX64(pos.tick_upper_index);
  const curSqrt = new BN(pool.current_sqrt_price);
  const coinAmounts = totalLiq.isZero()
    ? { amountA: new BN(0), amountB: new BN(0) }
    : ClmmPoolUtil.getCoinAmountFromLiquidity(
        totalLiq,
        curSqrt,
        lowerSqrt,
        upperSqrt,
        false
      );
  const slippageTol = new Percentage(new BN(5), new BN(100));
  const { tokenMaxA, tokenMaxB } = adjustForCoinSlippage(
    coinAmounts,
    slippageTol,
    false
  );

  // Gather rewards owed
  let rewarderCoinTypes: string[] = [];
  try {
    const rewards = await sdk.Rewarder.posRewardersAmount(
      actualPoolId,
      pool.positions_handle,
      positionId
    );
    rewarderCoinTypes = rewards
      .filter((r: any) => Number(r.amount_owed) > 0)
      .map((r: any) => r.coin_address);
  } catch {
    //
  }

  // Build & execute
  const tx = await sdk.Position.closePositionTransactionPayload({
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: actualPoolId,
    pos_id: positionId,
    min_amount_a: tokenMaxA.toString(),
    min_amount_b: tokenMaxB.toString(),
    rewarder_coin_types: rewarderCoinTypes,
  });
  const res = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: { showEvents: true, showEffects: true },
  });
  if (res.digest) showTransactionPopup(res.digest);
}

/**
 * Collect fees from a position.
 */
export async function collectFees(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  // Verify existence
  await fetchPositionFields(sdk, positionId);

  // On‐chain pool
  const pool = await sdk.Pool.getPool(poolId);
  if (!pool) throw new Error(`Pool ${poolId} not found`);

  const tx = await sdk.Position.collectFeeTransactionPayload(
    {
      coinTypeA: pool.coinTypeA,
      coinTypeB: pool.coinTypeB,
      pool_id: poolId,
      pos_id: positionId,
    },
    true
  );
  const res = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: { showEvents: true, showEffects: true },
  });
  if (res.digest) showTransactionPopup(res.digest);
}

/**
 * Collect rewards from a position.
 */
export async function collectRewards(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  // Verify existence
  await fetchPositionFields(sdk, positionId);

  // On‐chain pool
  const pool = await sdk.Pool.getPool(poolId);
  if (!pool) throw new Error(`Pool ${poolId} not found`);

  // Owed rewarders
  const rewards = await sdk.Rewarder.posRewardersAmount(
    poolId,
    pool.positions_handle,
    positionId
  );
  const rewarderCoinTypes = rewards
    .filter((r: any) => Number(r.amount_owed) > 0)
    .map((r: any) => r.coin_address);
  if (!rewarderCoinTypes.length) {
    console.log("No rewards owed");
    return;
  }

  const tx = await sdk.Rewarder.collectRewarderTransactionPayload({
    coinTypeA: pool.coinTypeA,
    coinTypeB: pool.coinTypeB,
    pool_id: poolId,
    pos_id: positionId,
    rewarder_coin_types: rewarderCoinTypes,
    collect_fee: false,
  });
  const res = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: { showEvents: true, showEffects: true },
  });
  if (res.digest) showTransactionPopup(res.digest);
}

/**
 * Fetch all positions owned by an address.
 */
export async function getPositions(
  ownerAddress: string
): Promise<Array<{ id: string; poolAddress: string; liquidity: number }>> {
  const sdk = initCetusSDK({ network: "mainnet" });
  try {
    const raw = await sdk.Position.getPositionList(ownerAddress);
    console.log("Raw positions data:", raw);

    // Process each position
    const positions = [];

    for (const p of raw) {
      // Get id from various possible fields
      const id = p.pos_object_id || p.id || p.position_id || p.nft_id || "";
      if (!id) continue; // Skip if no ID found

      // Try to extract the pool id
      let poolAddress = p.pool_id || p.pool || p.poolAddress || p.poolId || "";

      // If poolAddress is still empty, try to extract it from other fields
      if (!poolAddress) {
        poolAddress = extractPoolIdFromPosition(p);
      }

      // Return the position object with extracted data
      positions.push({
        id,
        poolAddress,
        liquidity: Number(p.liquidity) || 0,
      });
    }

    console.log("Processed positions:", positions);
    return positions;
  } catch (error) {
    console.error("Error fetching positions:", error);

    // Return empty array instead of throwing to allow UI to handle gracefully
    return [];
  }
}

/**
 * Fetch pool metadata for a set of pool addresses.
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
    // Return an empty array instead of throwing, so UI can handle gracefully
    return [];
  }
}
