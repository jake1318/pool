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

const PoolTable: React.FC<PoolTableProps> = ({
  pools,
  sortColumn,
  sortOrder,
  onSort,
  onDeposit,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4">Pool</th>
            <th
              className={`text-left py-3 px-4 cursor-pointer hover:bg-gray-800 ${
                sortColumn === "dex" ? "bg-gray-800" : ""
              }`}
              onClick={() => onSort("dex")}
            >
              DEX {sortColumn === "dex" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`text-right py-3 px-4 cursor-pointer hover:bg-gray-800 ${
                sortColumn === "liquidityUSD" ? "bg-gray-800" : ""
              }`}
              onClick={() => onSort("liquidityUSD")}
            >
              Liquidity{" "}
              {sortColumn === "liquidityUSD" &&
                (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`text-right py-3 px-4 cursor-pointer hover:bg-gray-800 ${
                sortColumn === "volumeUSD" ? "bg-gray-800" : ""
              }`}
              onClick={() => onSort("volumeUSD")}
            >
              Volume (24h){" "}
              {sortColumn === "volumeUSD" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`text-right py-3 px-4 cursor-pointer hover:bg-gray-800 ${
                sortColumn === "feesUSD" ? "bg-gray-800" : ""
              }`}
              onClick={() => onSort("feesUSD")}
            >
              Fees (24h){" "}
              {sortColumn === "feesUSD" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              className={`text-right py-3 px-4 cursor-pointer hover:bg-gray-800 ${
                sortColumn === "apr" ? "bg-gray-800" : ""
              }`}
              onClick={() => onSort("apr")}
            >
              APR {sortColumn === "apr" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
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
                <td className="py-4 px-4">
                  <PoolPair
                    tokenALogo={pool.tokenAMetadata?.logo_uri}
                    tokenBLogo={pool.tokenBMetadata?.logo_uri}
                    tokenASymbol={pool.tokenA}
                    tokenBSymbol={pool.tokenB}
                  />
                </td>
                <td className="py-4 px-4">
                  <div className="font-medium">{pool.dex}</div>
                  {pool.rewardSymbols.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pool.rewardSymbols.map((symbol, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-green-900 text-green-300 rounded-full text-xs"
                        >
                          {symbol}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
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
                  <span
                    className={
                      pool.apr > 100
                        ? "text-green-400"
                        : pool.apr > 50
                        ? "text-green-500"
                        : pool.apr > 20
                        ? "text-green-600"
                        : ""
                    }
                  >
                    {formatPercentage(pool.apr)}
                  </span>
                </td>
                <td className="text-right py-4 px-4">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    onClick={() => onDeposit(pool)}
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
