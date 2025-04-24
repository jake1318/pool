// src/services/suilendService.ts
// src/services/suilendService.ts
import { JsonRpcProvider, Connection, TransactionBlock } from "@mysten/sui";
import {
  SuiLendClient,
  MarketConfig,
  ReserveData,
  UserObligationData,
} from "@suilend/sdk";
import type { Wallet } from "@suiet/wallet-kit";

// ————————————————————————————————————
//  1) Set up Sui & Suilend client
// ————————————————————————————————————
const rpcUrl = getFullnodeUrl("mainnet");
const suiClient = new SuiClient({ url: rpcUrl });
const lendClient = new SuiLendClient(suiClient);

// ————————————————————————————————————
//  2) Types for our UI layer
// ————————————————————————————————————
export interface MarketsData {
  mainMarketSummary: {
    totalDepositsUSD: number;
    totalBorrowsUSD: number;
    totalTvlUSD: number;
  };
  assets: Array<{
    coinType: string;
    symbol: string;
    name: string;
    price: number;
    totalDepositsUSD: number;
    totalBorrowsUSD: number;
    depositApr: number;
    borrowApr: number;
    ltv: number;
    isBorrowable: boolean;
    category: "main" | "isolated";
  }>;
}

export interface UserObligation {
  totalBorrowUSD: number;
  borrowLimitUSD: number;
  healthFactor: number;
}

// ————————————————————————————————————
//  3) Fetch all markets (main + isolated)
// ————————————————————————————————————
export async function fetchMarketsData(): Promise<MarketsData> {
  const config: MarketConfig = await lendClient.getMarketConfig();
  const raw = await lendClient.getAllMarkets(config);

  let totalDepositsUSD = 0;
  let totalBorrowsUSD = 0;
  const assets: MarketsData["assets"] = [];

  // main market reserves
  raw.mainMarket.reserves.forEach((r: ReserveData) => {
    assets.push({
      coinType: r.coinType,
      symbol: r.symbol,
      name: r.name,
      price: r.priceUSD,
      totalDepositsUSD: r.totalDepositsUSD,
      totalBorrowsUSD: r.totalBorrowsUSD,
      depositApr: r.depositApy,
      borrowApr: r.borrowApy,
      ltv: r.collateralFactor,
      isBorrowable: r.canBorrow,
      category: "main",
    });
    totalDepositsUSD += r.totalDepositsUSD;
    totalBorrowsUSD += r.totalBorrowsUSD;
  });

  // isolated market reserves
  raw.isolatedMarkets.forEach((mkt) =>
    mkt.reserves.forEach((r: ReserveData) => {
      assets.push({
        coinType: r.coinType,
        symbol: r.symbol,
        name: r.name,
        price: r.priceUSD,
        totalDepositsUSD: r.totalDepositsUSD,
        totalBorrowsUSD: r.totalBorrowsUSD,
        depositApr: r.depositApy,
        borrowApr: r.borrowApy,
        ltv: r.collateralFactor,
        isBorrowable: r.canBorrow,
        category: "isolated",
      });
      totalDepositsUSD += r.totalDepositsUSD;
      totalBorrowsUSD += r.totalBorrowsUSD;
    })
  );

  return {
    mainMarketSummary: {
      totalDepositsUSD,
      totalBorrowsUSD,
      totalTvlUSD: totalDepositsUSD - totalBorrowsUSD,
    },
    assets,
  };
}

// ————————————————————————————————————
//  4) Fetch a user’s obligation & health factor
// ————————————————————————————————————
export async function fetchUserObligation(
  userAddress: string
): Promise<UserObligation | null> {
  const raw: UserObligationData | null = await lendClient.getUserObligation(
    userAddress
  );
  if (!raw) return null;

  const totalBorrowUSD = raw.totalBorrowValue;
  const borrowLimitUSD = raw.borrowLimitValue;
  const healthFactor =
    totalBorrowUSD > 0 ? borrowLimitUSD / totalBorrowUSD : Infinity;

  return { totalBorrowUSD, borrowLimitUSD, healthFactor };
}

// ————————————————————————————————————
//  5) Helper: fetch on-chain wallet balance
// ————————————————————————————————————
export async function fetchWalletBalance(
  ownerAddress: string,
  coinType: string
): Promise<number> {
  const balance = await suiClient.getBalance({ owner: ownerAddress, coinType });
  const amount = BigInt(balance.totalBalance);
  const reserve = await lendClient.getReserveData(coinType);
  return Number(amount) / 10 ** reserve.decimals;
}

// ————————————————————————————————————
//  6) Build Tx helpers
// ————————————————————————————————————
async function sendTx(wallet: Wallet, txb: TransactionBlock) {
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: txb });
}

export async function deposit(
  wallet: Wallet,
  coinType: string,
  uiAmount: number
) {
  const rsv = await lendClient.getReserveData(coinType);
  const amount = BigInt(Math.floor(uiAmount * 10 ** rsv.decimals));
  const txb = new TransactionBlock();
  await lendClient.createDepositTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount,
  });
  return sendTx(wallet, txb);
}

export async function withdraw(
  wallet: Wallet,
  coinType: string,
  uiAmount: number
) {
  const rsv = await lendClient.getReserveData(coinType);
  const amount = BigInt(Math.floor(uiAmount * 10 ** rsv.decimals));
  const txb = new TransactionBlock();
  await lendClient.createWithdrawTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount,
  });
  return sendTx(wallet, txb);
}

export async function borrow(
  wallet: Wallet,
  coinType: string,
  uiAmount: number
) {
  const rsv = await lendClient.getReserveData(coinType);
  const amount = BigInt(Math.floor(uiAmount * 10 ** rsv.decimals));
  const txb = new TransactionBlock();
  await lendClient.createBorrowTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount,
  });
  return sendTx(wallet, txb);
}

export async function repay(
  wallet: Wallet,
  coinType: string,
  uiAmount: number
) {
  const rsv = await lendClient.getReserveData(coinType);
  const amount = BigInt(Math.floor(uiAmount * 10 ** rsv.decimals));
  const txb = new TransactionBlock();
  await lendClient.createRepayTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount,
  });
  return sendTx(wallet, txb);
}
