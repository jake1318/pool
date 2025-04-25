// -----------------------------------------------------------------------------
//  Suilend integration helper functions
//  * compatible with @mysten/sui 1.21.x (ESM sub-paths)
// -----------------------------------------------------------------------------

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction as TransactionBlock } from "@mysten/sui/transactions";

import {
  SuiLendClient,
  MarketConfig,
  ReserveData,
  UserObligationData,
} from "@suilend/sdk";

import type { Wallet } from "@suiet/wallet-kit";

// -----------------------------------------------------------------------------
//  1)  RPC + client instances
// -----------------------------------------------------------------------------
const rpcUrl = getFullnodeUrl("mainnet");
const suiClient = new SuiClient({ url: rpcUrl });
const lendClient = new SuiLendClient(suiClient);

// -----------------------------------------------------------------------------
//  2)  UI helper types
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
//  3)  Market data
// -----------------------------------------------------------------------------
export async function fetchMarketsData(): Promise<MarketsData> {
  const cfg: MarketConfig = await lendClient.getMarketConfig();
  const raw = await lendClient.getAllMarkets(cfg);

  let totalDepositsUSD = 0;
  let totalBorrowsUSD = 0;
  const assets: MarketsData["assets"] = [];

  const pushReserve = (r: ReserveData, category: "main" | "isolated") => {
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
      category,
    });
    totalDepositsUSD += r.totalDepositsUSD;
    totalBorrowsUSD += r.totalBorrowsUSD;
  };

  raw.mainMarket.reserves.forEach((r) => pushReserve(r, "main"));
  raw.isolatedMarkets.forEach((mkt) =>
    mkt.reserves.forEach((r) => pushReserve(r, "isolated"))
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

// -----------------------------------------------------------------------------
//  4)  User obligation
// -----------------------------------------------------------------------------
export async function fetchUserObligation(
  addr: string
): Promise<UserObligation | null> {
  const raw: UserObligationData | null = await lendClient.getUserObligation(
    addr
  );
  if (!raw) return null;

  const { totalBorrowValue: totalBorrowUSD, borrowLimitValue: borrowLimitUSD } =
    raw;
  return {
    totalBorrowUSD,
    borrowLimitUSD,
    healthFactor:
      totalBorrowUSD > 0 ? borrowLimitUSD / totalBorrowUSD : Infinity,
  };
}

// -----------------------------------------------------------------------------
//  5)  Wallet balance for a specific coin type
// -----------------------------------------------------------------------------
export async function fetchWalletBalance(
  owner: string,
  coinType: string
): Promise<number> {
  const bal = await suiClient.getBalance({ owner, coinType });
  const reserve = await lendClient.getReserveData(coinType);
  return Number(BigInt(bal.totalBalance)) / 10 ** reserve.decimals;
}

// -----------------------------------------------------------------------------
//  6)  Tx helpers (deposit / withdraw / borrow / repay)
// -----------------------------------------------------------------------------
const sendTx = (wallet: Wallet, txb: TransactionBlock) =>
  wallet.signAndExecuteTransactionBlock({ transactionBlock: txb });

async function buildAmount(
  coinType: string,
  uiAmount: number
): Promise<bigint> {
  const r = await lendClient.getReserveData(coinType);
  return BigInt(Math.floor(uiAmount * 10 ** r.decimals));
}

export async function deposit(wallet: Wallet, coinType: string, uiAmt: number) {
  const txb = new TransactionBlock();
  await lendClient.createDepositTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount: await buildAmount(coinType, uiAmt),
  });
  return sendTx(wallet, txb);
}

export async function withdraw(
  wallet: Wallet,
  coinType: string,
  uiAmt: number
) {
  const txb = new TransactionBlock();
  await lendClient.createWithdrawTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount: await buildAmount(coinType, uiAmt),
  });
  return sendTx(wallet, txb);
}

export async function borrow(wallet: Wallet, coinType: string, uiAmt: number) {
  const txb = new TransactionBlock();
  await lendClient.createBorrowTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount: await buildAmount(coinType, uiAmt),
  });
  return sendTx(wallet, txb);
}

export async function repay(wallet: Wallet, coinType: string, uiAmt: number) {
  const txb = new TransactionBlock();
  await lendClient.createRepayTx({
    tx: txb,
    user: wallet.account.address,
    coinType,
    amount: await buildAmount(coinType, uiAmt),
  });
  return sendTx(wallet, txb);
}
