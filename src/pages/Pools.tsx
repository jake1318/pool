import React, { useState, useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import SearchBar from "../components/SearchBar";
import PoolTable from "../components/PoolTable";
import DepositModal from "../components/DepositModal";
import { PoolInfo } from "../services/coinGeckoService";
import * as coinGeckoService from "../services/coinGeckoService";
import * as cetusService from "../services/cetusService";

const Pools: React.FC = () => {
  const wallet = useWallet();
  const [defaultPools, setDefaultPools] = useState<PoolInfo[]>([]);
  const [searchResults, setSearchResults] = useState<PoolInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<
    "dex" | "liquidityUSD" | "volumeUSD" | "feesUSD" | "apr"
  >("volumeUSD");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showIncentivizedOnly, setShowIncentivizedOnly] = useState(false);

  // ** New modal state **
  const [modalPool, setModalPool] = useState<PoolInfo | null>(null);

  useEffect(() => {
    coinGeckoService
      .getDefaultPools()
      .then(setDefaultPools)
      .catch((err) => console.error("Failed to load pools:", err));
  }, []);

  const handleSearchSubmit = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    coinGeckoService
      .searchPools(searchTerm.trim())
      .then(setSearchResults)
      .catch((err) => console.error("Search failed:", err));
  };

  const handleToggleIncentivized = () => {
    setShowIncentivizedOnly((prev) => !prev);
  };

  const handleSortChange = (
    columnKey: "dex" | "liquidityUSD" | "volumeUSD" | "feesUSD" | "apr"
  ) => {
    if (columnKey === sortColumn) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortOrder("desc");
    }
  };

  // ** instead of prompt, just open modal **
  const handleDeposit = (pool: PoolInfo) => {
    if (!wallet.connected) {
      alert("Please connect your Sui wallet to deposit liquidity.");
      return;
    }
    setModalPool(pool);
  };

  // ** Called when user submits modal **
  const handleModalConfirm = (amtA: number, amtB: number) => {
    if (!modalPool) return;
    cetusService
      .deposit(wallet, modalPool.address, amtA, amtB)
      .then(() => {
        alert(`Deposit tx sent for ${modalPool.name}`);
        setModalPool(null);
      })
      .catch((err) => {
        console.error("Deposit failed:", err);
        alert("Deposit failed, see console.");
      });
  };
  const handleModalClose = () => setModalPool(null);

  const currentPools =
    searchTerm && searchResults.length > 0 ? searchResults : defaultPools;
  const filteredPools = showIncentivizedOnly
    ? currentPools.filter((p) => p.rewardSymbols.length > 0)
    : currentPools;

  const displayedPools = [...filteredPools].sort((a, b) => {
    const valA = a[sortColumn] ?? 0;
    const valB = b[sortColumn] ?? 0;
    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    return sortOrder === "asc"
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  return (
    <div className="pools-page">
      <div className="filters">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          onSubmit={handleSearchSubmit}
          placeholder="🔍 Filter by token or address"
        />
        <label className="incent-toggle">
          <input
            type="checkbox"
            checked={showIncentivizedOnly}
            onChange={handleToggleIncentivized}
          />{" "}
          Incentivized only
        </label>
      </div>

      <PoolTable
        pools={displayedPools}
        sortColumn={sortColumn}
        sortOrder={sortOrder}
        onSort={handleSortChange}
        onDeposit={handleDeposit}
      />

      {modalPool && (
        <DepositModal
          pool={modalPool}
          onConfirm={handleModalConfirm}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default Pools;
