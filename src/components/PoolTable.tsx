import React from "react";
import { PoolInfo } from "../services/coinGeckoService";
import { formatDollars, formatPercentage } from "../utils/formatters";
import { TokenLogo, PoolPair } from "./TokenLogo";

interface PoolTableProps {
  pools: PoolInfo[];
  sortColumn: "dex" | "liquidityUSD" | "volumeUSD" | "feesUSD" | "apr";
  sortOrder: "asc" | "desc";
  onSort: (
    column: "dex" | "liquidityUSD" | "volumeUSD" | "feesUSD" | "apr"
  ) => void;
  onDeposit: (pool: PoolInfo) => void;
}

/** Returns a coloured-text CSS class depending on APR */
const aprColour = (apr: number): string => {
  if (apr >= 100) return "text-green-400";
  if (apr >= 50) return "text-green-500";
  if (apr >= 20) return "text-green-600";
  return "";
};

const PoolTable: React.FC<PoolTableProps> = ({
  pools,
  sortColumn,
  sortOrder,
  onSort,
  onDeposit,
}) => {
  /** header cell builder */
  const header = (
    label: string,
    col: PoolTableProps["sortColumn"],
    className = ""
  ) => (
    <th
      className={`py-3 px-4 cursor-pointer hover:bg-gray-800 text-left ${className} ${
        sortColumn === col ? "bg-gray-800" : ""
      }`}
      onClick={() => onSort(col)}
    >
      {label}{" "}
      {sortColumn === col && (
        <span className="inline-block ml-0.5">
          {sortOrder === "asc" ? "↑" : "↓"}
        </span>
      )}
    </th>
  );

  // Handle deposit button click with stop propagation
  const handleDepositClick = (e: React.MouseEvent, pool: PoolInfo) => {
    e.stopPropagation(); // Stop event propagation
    console.log("Deposit button clicked for:", pool.name);
    onDeposit(pool);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4">Pool</th>
            {header("DEX", "dex")}
            {header("Liquidity", "liquidityUSD", "text-right")}
            {header("Volume (24h)", "volumeUSD", "text-right")}
            {header("Fees (24h)", "feesUSD", "text-right")}
            {header("APR", "apr", "text-right")}
            <th className="text-right py-3 px-4">Action</th>
          </tr>
        </thead>

        <tbody>
          {pools.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-4 text-center text-gray-500">
                No pools found
              </td>
            </tr>
          ) : (
            pools.map((pool) => (
              <tr
                key={pool.address}
                className="border-b border-gray-800 hover:bg-gray-800"
              >
                {/* -------- Pool column (logos + pair name + fee tier) -------- */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    {/* Token pair logos */}
                    <div className="flex -space-x-2">
                      <TokenLogo
                        logoUrl={pool.tokenAMetadata?.logo_uri}
                        symbol={pool.tokenA}
                      />
                      <TokenLogo
                        logoUrl={pool.tokenBMetadata?.logo_uri}
                        symbol={pool.tokenB}
                      />
                    </div>

                    {/* Pair name & fee */}
                    <div className="flex flex-col">
                      <span className="font-medium whitespace-nowrap">
                        {pool.tokenA} / {pool.tokenB}
                      </span>

                      {/* Fee badge if present */}
                      {pool.name && pool.name.match(/(\d+(\.\d+)?)%/) && (
                        <span className="fee-tier inline-block mt-0.5">
                          {pool.name.match(/(\d+(\.\d+)?)%/)![0]}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* -------- DEX column (name + reward icons) -------- */}
                <td className="py-4 px-4">
                  <div className="font-medium capitalize">{pool.dex}</div>
                  {/* Reward token badges */}
                  {pool.rewardSymbols.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pool.rewardSymbols.map((sym) => (
                        <span
                          key={sym}
                          className="px-2 py-0.5 bg-green-900 text-green-300 rounded-full text-xs"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* -------- Numbers -------- */}
                <td className="text-right py-4 px-4">
                  {formatDollars(pool.liquidityUSD)}
                </td>
                <td className="text-right py-4 px-4">
                  {formatDollars(pool.volumeUSD)}
                </td>
                <td className="text-right py-4 px-4">
                  {formatDollars(pool.feesUSD)}
                </td>
                <td className="text-right py-4 px-4">
                  <span className={aprColour(pool.apr)}>
                    {formatPercentage(pool.apr)}
                  </span>
                </td>

                {/* -------- Action -------- */}
                <td className="text-right py-4 px-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    onClick={(e) => handleDepositClick(e, pool)}
                  >
                    Deposit
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PoolTable;
