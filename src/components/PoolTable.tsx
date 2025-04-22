import React from "react";
import type { PoolInfo } from "../services/coinGeckoService";
import { formatUSD, formatPercent } from "../utils/format";

interface PoolTableProps {
  pools: PoolInfo[];
  sortColumn: "dex" | "liquidityUSD" | "volumeUSD" | "feesUSD" | "apr";
  sortOrder: "asc" | "desc";
  onSort: (column: PoolTableProps["sortColumn"]) => void;
  onDeposit: (pool: PoolInfo) => void;
}

/**
 * Compute APR as a decimal ratio:
 *  • If API gave you pool.apr (as a decimal, e.g. 0.20 for 20%), use that
 *  • Otherwise approximate from 24 h fees / TVL:
 *      daily_fee_usd / liquidity_usd × 365
 */
const computeApr = (pool: PoolInfo): number => {
  // assume pool.apr from CoinGecko is a decimal already (0.20 → 20%)
  if (typeof pool.apr === "number" && pool.apr > 0) {
    return pool.apr;
  }
  if (pool.liquidityUSD > 0) {
    return (pool.feesUSD / pool.liquidityUSD) * 365;
  }
  return 0;
};

const PoolTable: React.FC<PoolTableProps> = ({
  pools,
  sortColumn,
  sortOrder,
  onSort,
  onDeposit,
}) => {
  const headerCell = (label: string, colKey: PoolTableProps["sortColumn"]) => (
    <th
      className="sortable"
      style={{ cursor: "pointer" }}
      onClick={() => onSort(colKey)}
    >
      {label}
      {sortColumn === colKey && (
        <span className="sort-indicator">
          {sortOrder === "asc" ? "▲" : "▼"}
        </span>
      )}
    </th>
  );

  return (
    <table className="pool-table">
      <thead>
        <tr>
          <th>Pool</th>
          {headerCell("DEX", "dex")}
          {headerCell("Liquidity", "liquidityUSD")}
          {headerCell("Volume (24H)", "volumeUSD")}
          {headerCell("Fees (24H)", "feesUSD")}
          {headerCell("APR", "apr")}
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {pools.map((pool) => {
          const aprRatio = computeApr(pool);
          return (
            <tr key={pool.address}>
              <td>{pool.name}</td>
              <td>{pool.dex.toUpperCase()}</td>
              <td>{formatUSD(pool.liquidityUSD)}</td>
              <td>{formatUSD(pool.volumeUSD)}</td>
              <td>{formatUSD(pool.feesUSD)}</td>
              <td>{formatPercent(aprRatio)}</td>
              <td>
                <button className="btn-deposit" onClick={() => onDeposit(pool)}>
                  Deposit
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default PoolTable;
