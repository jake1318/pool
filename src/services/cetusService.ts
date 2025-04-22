// src/services/cetusService.ts

import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";
import type { WalletContextState } from "@suiet/wallet-kit";
import type { PoolInfo } from "./coinGeckoService";

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

  const tickLower = -100_000;
  const tickUpper = 100_000;

  // 1) open position
  const openTx = await sdk.Position.openPositionTransactionBlock({
    pool_id: poolId,
    tick_lower: tickLower,
    tick_upper: tickUpper,
  });
  const openRes = await wallet.signAndExecuteTransactionBlock({
    transactionBlock: openTx,
  });

  // extract position id
  const evt = openRes.events?.find(
    (e) =>
      e.type.endsWith("::PositionCreated") ||
      e.type.endsWith("::PositionOpened")
  );
  const positionId =
    (evt?.parsedJson as any)?.position_id || (evt?.parsedJson as any)?.pos_id;
  if (!positionId) {
    throw new Error("Failed to extract position ID");
  }

  // 2) add liquidity
  const addLiqTx = await sdk.Position.addLiquidityTransactionBlock({
    pos_id: positionId,
    pool_id: poolId,
    coin_x_amount: amountX.toString(),
    coin_y_amount: amountY.toString(),
  });
  await wallet.signAndExecuteTransactionBlock({
    transactionBlock: addLiqTx,
  });
}

/**
 * Remove all liquidity from a position.
 */
export async function withdraw(
  wallet: WalletContextState,
  poolId: string,
  positionId: string,
  liquidityAmount: number
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  const removeLiqTx = await sdk.Position.removeLiquidityTransactionBlock({
    pos_id: positionId,
    pool_id: poolId,
    liquidity: liquidityAmount.toString(),
  });
  await wallet.signAndExecuteTransactionBlock({
    transactionBlock: removeLiqTx,
  });
}

/**
 * Claim all accrued rewards for a position.
 */
export async function claimRewards(
  wallet: WalletContextState,
  poolId: string,
  positionId: string
): Promise<void> {
  if (!wallet.connected || !wallet.account?.address) {
    throw new Error("Wallet not connected");
  }
  const address = wallet.account.address;
  const sdk = getSdkWithWallet(address);

  const collectRewardsTx = await sdk.Position.collectRewardsTransactionBlock({
    pool_id: poolId,
    pos_id: positionId,
    rewarder_coin_types: [],
  });
  await wallet.signAndExecuteTransactionBlock({
    transactionBlock: collectRewardsTx,
  });
}

/**
 * Fetch all positions owned by an address.
 */
export async function getPositions(
  ownerAddress: string
): Promise<Array<{ id: string; poolAddress: string; liquidity: number }>> {
  const sdk = initCetusSDK({ network: "mainnet" });
  const raw = await sdk.Position.getPositionList(ownerAddress);
  return raw.map((p) => ({
    id: p.id,
    poolAddress: p.pool_id,
    liquidity: Number(p.liquidity) || 0,
  }));
}

/**
 * Fetch pool metadata for a set of pool addresses.
 */
export async function getPoolsDetailsForPositions(
  addresses: string[]
): Promise<PoolInfo[]> {
  const { getPoolsByAddresses } = await import("./coinGeckoService");
  return getPoolsByAddresses(addresses);
}
