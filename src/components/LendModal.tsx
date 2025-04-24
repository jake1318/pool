import React, { useState, useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import * as suilendService from "../services/suilendService";
import type { AssetInfo } from "../pages/Lending";

interface LendModalProps {
  asset: AssetInfo;
  onClose: () => void;
}

const LendModal: React.FC<LendModalProps> = ({ asset, onClose }) => {
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<
    "Deposit" | "Borrow" | "Withdraw" | "Repay"
  >("Deposit");
  const [amount, setAmount] = useState<string>(""); // user input amount
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [borrowLimit, setBorrowLimit] = useState<number | null>(null);
  const [utilization, setUtilization] = useState<number | null>(null);
  const [healthFactor, setHealthFactor] = useState<number | null>(null);
  const [userLoading, setUserLoading] = useState<boolean>(true);

  useEffect(() => {
    // Fetch user-specific data (wallet balance and borrow limits) when modal opens
    const fetchUserData = async () => {
      if (!wallet.account || !wallet.connected) {
        setWalletBalance(null);
        setBorrowLimit(null);
        setUtilization(null);
        setHealthFactor(null);
        setUserLoading(false);
        return;
      }
      setUserLoading(true);
      try {
        // Fetch wallet balance for the asset's coin type
        const balance = await suilendService.fetchWalletBalance(
          wallet.account.address,
          asset.symbol
        );
        setWalletBalance(balance);

        // Fetch user's overall obligation (deposits/borrows) to compute borrow limit and health
        const obligation = await suilendService.fetchUserObligation(
          wallet.account.address
        );
        if (obligation) {
          setBorrowLimit(obligation.borrowLimitUSD);
          setUtilization(
            obligation.borrowLimitUSD > 0
              ? obligation.totalBorrowUSD / obligation.borrowLimitUSD
              : 0
          );
          setHealthFactor(
            obligation.totalBorrowUSD === 0
              ? null
              : obligation.borrowLimitUSD / obligation.totalBorrowUSD
          );
        } else {
          // User has no obligation (no deposits/borrows yet)
          setBorrowLimit(0);
          setUtilization(0);
          setHealthFactor(null);
        }
      } catch (error) {
        console.error("Failed to fetch user obligation or balance:", error);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUserData();
  }, [wallet, asset.symbol]);

  const handleAction = async () => {
    if (!wallet.account || !wallet.connected) {
      wallet.select(); // prompt connect if not connected
      return;
    }
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      return;
    }
    try {
      if (activeTab === "Deposit") {
        await suilendService.deposit(wallet, asset.symbol, amtNum);
      } else if (activeTab === "Withdraw") {
        await suilendService.withdraw(wallet, asset.symbol, amtNum);
      } else if (activeTab === "Borrow") {
        await suilendService.borrow(wallet, asset.symbol, amtNum);
      } else if (activeTab === "Repay") {
        await suilendService.repay(wallet, asset.symbol, amtNum);
      }
      // After action, refresh user data
      setAmount("");
      const obligation = await suilendService.fetchUserObligation(
        wallet.account.address
      );
      if (obligation) {
        setBorrowLimit(obligation.borrowLimitUSD);
        setUtilization(
          obligation.borrowLimitUSD > 0
            ? obligation.totalBorrowUSD / obligation.borrowLimitUSD
            : 0
        );
        setHealthFactor(
          obligation.totalBorrowUSD === 0
            ? null
            : obligation.borrowLimitUSD / obligation.totalBorrowUSD
        );
      }
      if (activeTab === "Withdraw" || activeTab === "Deposit") {
        // update wallet balance after supply actions
        const newBalance = await suilendService.fetchWalletBalance(
          wallet.account.address,
          asset.symbol
        );
        setWalletBalance(newBalance);
      }
    } catch (error) {
      console.error(`${activeTab} action failed:`, error);
      // Ideally show notification to user on failure
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* Modal overlay */}
      <div className="bg-neutral-800 text-gray-100 p-6 rounded-lg w-80 sm:w-[400px] relative">
        {/* Tabs */}
        <div className="flex justify-between mb-4">
          {(["Deposit", "Borrow", "Withdraw", "Repay"] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 text-center py-2 ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-700 text-gray-300"
              } mx-1 rounded`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Amount Input Section */}
        <div className="mb-3">
          <div className="flex justify-between items-center bg-neutral-700 px-3 py-2 rounded">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              className="bg-transparent flex-1 outline-none text-xl text-white"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="ml-2 font-semibold">{asset.symbol}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-gray-400">
            <button
              className="underline"
              onClick={() =>
                walletBalance && setAmount(walletBalance.toString())
              }
            >
              MAX
            </button>
            <span>
              {walletBalance !== null
                ? `${walletBalance.toFixed(4)} ${asset.symbol}`
                : "--"}
            </span>
          </div>
        </div>
        {/* Asset Price and APR info */}
        <div className="text-sm mb-3">
          <div className="flex justify-between">
            <span>Price:</span>
            <span>${asset.price.toFixed(2)}</span>
          </div>
          {activeTab === "Deposit" || activeTab === "Withdraw" ? (
            <div className="flex justify-between">
              <span>Deposit APR:</span>
              <span>{asset.depositApr.toFixed(2)}%</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Borrow APR:</span>
              <span>{asset.borrowApr.toFixed(2)}%</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Collateral LTV:</span>
            <span>{asset.ltv}%</span>
          </div>
          {/* User-specific metrics */}
          <div className="mt-2 border-t border-gray-700 pt-2 text-xs">
            <div className="flex justify-between">
              <span>Your borrow limit:</span>
              <span>
                {borrowLimit !== null ? `$${borrowLimit.toFixed(2)}` : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Your utilization:</span>
              <span>
                {utilization !== null
                  ? `${(utilization * 100).toFixed(2)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Health factor:</span>
              <span>
                {healthFactor !== null ? healthFactor.toFixed(2) : "N/A"}
              </span>
            </div>
          </div>
        </div>
        {/* Action Button */}
        <button
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded mb-2 disabled:opacity-50"
          onClick={handleAction}
          disabled={userLoading}
        >
          {wallet.connected ? `${activeTab} ${asset.symbol}` : "Connect Wallet"}
        </button>
        {/* Close modal */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default LendModal;
