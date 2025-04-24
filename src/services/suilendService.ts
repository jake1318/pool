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

const RPC_URL = "https://fullnode.mainnet.sui.io:443";
const provider = new JsonRpcProvider(new Connection({ fullnode: RPC_URL }));

// Initialize the on-chain lending client
// (this will fetch on-chain config from the SDK’s published config package)
const lendClient = new SuiLendClient(provider);

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
    coinType: string; // Move type, e.g. "0x2::sui::SUI"
    symbol: string; // e.g. "SUI"
    name: string; // e.g. "Sui"
    price: number; // in USD
    totalDepositsUSD: number;
    totalBorrowsUSD: number;
    depositApr: number; // e.g. 0.0312 = 3.12%
    borrowApr: number;
    ltv: number; // collateral factor as percent, e.g. 75
    isBorrowable: boolean;
    category: "main" | "isolated";
  }>;
}

export interface UserObligation {
  totalBorrowUSD: number;
  borrowLimitUSD: number;
  healthFactor: number; // borrowLimit / totalBorrow
}

// ————————————————————————————————————
//  3) Fetch all markets (main + isolated)
// ————————————————————————————————————

export async function fetchMarketsData(): Promise<MarketsData> {
  // the SDK’s `getAllMarkets` returns both main & isolated reserves
  const config: MarketConfig = await lendClient.getMarketConfig();
  const raw = await lendClient.getAllMarkets(config);

  let totalDepositsUSD = 0;
  let totalBorrowsUSD = 0;
  const assets: MarketsData["assets"] = [];

  // main market
  raw.mainMarket.reserves.forEach((r: ReserveData) => {
    assets.push({
      coinType: r.coinType,
      symbol: r.symbol,
      name: r.name,
      price: r.priceUSD,
      totalDepositsUSD: r.totalDepositsUSD,
      totalBorrowsUSD: r.totalBorrowsUSD,
      depositApr: r.depositApy, // SDK field
      borrowApr: r.borrowApy,
      ltv: r.collateralFactor, // percent, e.g. 75
      isBorrowable: r.canBorrow,
      category: "main",
    });
    totalDepositsUSD += r.totalDepositsUSD;
    totalBorrowsUSD += r.totalBorrowsUSD;
  });

  // isolated markets (optional groups of assets)
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
//  4) Fetch a user’s total borrow/limit & health factor
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
    borrowLimitUSD > 0 ? borrowLimitUSD / totalBorrowUSD : Infinity;

  return {
    totalBorrowUSD,
    borrowLimitUSD,
    healthFactor,
  };
}

// ————————————————————————————————————
//  5) Helper: fetch on-chain wallet balance for a coinType
// ————————————————————————————————————

export async function fetchWalletBalance(
  ownerAddress: string,
  coinType: string
): Promise<number> {
  // get raw SUI balance object for that coin type
  const balance = await provider.getBalance({
    owner: ownerAddress,
    coinType: coinType,
  });
  // Sui.js returns totalCoin as a string of small units
  const amount = BigInt(balance.totalBalance);
  // get decimals from the reserve config
  const reserve = await lendClient.getReserveData(coinType);
  return Number(amount) / 10 ** reserve.decimals;
}

// ————————————————————————————————————
//  6) Deposit / Withdraw / Borrow / Repay
// ————————————————————————————————————

async function sendTx(wallet: Wallet, txb: TransactionBlock) {
  return wallet.signAndExecuteTransactionBlock({
    transactionBlock: txb,
  });
}

export async function deposit(
  wallet: Wallet,
  coinType: string,
  uiAmount: number
) {
  // build & sign a deposit tx
  const rsv = await lendClient.getReserveData(coinType);
  const amount = BigInt(Math.floor(uiAmount * 10 ** rsv.decimals));

  const txb = new TransactionBlock();
  await lendClient.createDepositTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount, // in atomic units
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
