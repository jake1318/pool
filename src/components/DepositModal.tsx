import React, { useState } from "react";
import { PoolInfo } from "../services/coinGeckoService";
import { TokenLogo } from "./TokenLogo";

interface DepositModalProps {
  pool: PoolInfo;
  onConfirm: (amountA: number, amountB: number) => void;
  onClose: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({
  pool,
  onConfirm,
  onClose,
}) => {
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numA = parseFloat(amountA);
    const numB = parseFloat(amountB);
    if (isNaN(numA) || isNaN(numB) || numA <= 0 || numB <= 0) {
      alert("Please enter valid amounts for both tokens.");
      return;
    }
    onConfirm(numA, numB);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-75">
      <div className="w-full max-w-md bg-gray-900 rounded-lg shadow-lg p-6 m-4">
        <h3 className="text-lg font-medium text-white mb-4">
          Deposit Liquidity
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              <div className="flex items-center">
                <TokenLogo
                  logoUrl={pool.tokenAMetadata?.logo_uri}
                  symbol={pool.tokenA}
                  size="sm"
                />
                <span className="ml-2">{pool.tokenA} Amount</span>
              </div>
            </label>
            <input
              type="number"
              step="any"
              className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:border-blue-500"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              placeholder={`Enter ${pool.tokenA} amount`}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              <div className="flex items-center">
                <TokenLogo
                  logoUrl={pool.tokenBMetadata?.logo_uri}
                  symbol={pool.tokenB}
                  size="sm"
                />
                <span className="ml-2">{pool.tokenB} Amount</span>
              </div>
            </label>
            <input
              type="number"
              step="any"
              className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:outline-none focus:border-blue-500"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              placeholder={`Enter ${pool.tokenB} amount`}
              required
            />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700"
            >
              Deposit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
