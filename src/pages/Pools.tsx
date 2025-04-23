import React, { useState, useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import SearchBar from "../components/SearchBar";
import PoolTable from "../components/PoolTable";
import DepositModal from "../components/DepositModal";
import { PoolInfo } from "../services/coinGeckoService";
import * as coinGeckoService from "../services/coinGeckoService";
import * as cetusService from "../services/cetusService";
import * as birdeyeService from "../services/birdeyeService";

const MAX_TOKENS_FOR_METADATA = 20; // Limit the number of tokens we fetch metadata for initially

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
  const [loading, setLoading] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Modal state
  const [modalPool, setModalPool] = useState<PoolInfo | null>(null);

  // Fetch pools and enhance them with token metadata
  useEffect(() => {
    async function fetchPools() {
      setLoading(true);
      try {
        // Get pools from CoinGecko
        const pools = await coinGeckoService.getDefaultPools();

        // Store pools without metadata first to show data quickly
        setDefaultPools(pools);
        setLoading(false);

        // Then fetch metadata in the background
        fetchTokenMetadata(pools);
      } catch (error) {
        console.error("Failed to load pools:", error);
        setLoading(false);
      }
    }

    fetchPools();
  }, []);

  // Function to fetch token metadata separately from pool loading
  const fetchTokenMetadata = async (pools: PoolInfo[]) => {
    setLoadingMetadata(true);
    try {
      // Collect unique token addresses to fetch metadata
      const tokenAddresses = new Set<string>();

      // Sort pools by liquidityUSD to prioritize metadata for most important pools
      const sortedPools = [...pools].sort(
        (a, b) => b.liquidityUSD - a.liquidityUSD
      );

      // Take only the top pools to avoid too many requests
      const topPools = sortedPools.slice(0, MAX_TOKENS_FOR_METADATA);

      topPools.forEach((pool) => {
        if (pool.tokenAAddress && !tokenAddresses.has(pool.tokenAAddress)) {
          tokenAddresses.add(pool.tokenAAddress);
        }
        if (pool.tokenBAddress && !tokenAddresses.has(pool.tokenBAddress)) {
          tokenAddresses.add(pool.tokenBAddress);
        }
      });

      if (tokenAddresses.size > 0) {
        const tokenAddressArray = Array.from(tokenAddresses);
        console.log(
          `Fetching metadata for top ${tokenAddressArray.length} tokens`
        );

        // Fetch token metadata
        const metadata = await birdeyeService.getMultipleTokenMetadata(
          tokenAddressArray
        );
        console.log(
          `Fetched metadata for ${Object.keys(metadata).length} tokens`
        );

        // Add metadata to pool objects
        const enhancedPools = pools.map((pool) => ({
          ...pool,
          tokenAMetadata: pool.tokenAAddress
            ? metadata[pool.tokenAAddress]
            : undefined,
          tokenBMetadata: pool.tokenBAddress
            ? metadata[pool.tokenBAddress]
            : undefined,
        }));

        setDefaultPools(enhancedPools);
      }
    } catch (error) {
      console.error("Failed to fetch token metadata:", error);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleSearchSubmit = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      // Use existing search function
      const results = await coinGeckoService.searchPools(searchTerm.trim());

      // Try to use metadata we've already fetched
      const enhancedResults = results.map((pool) => {
        const matchingPool = defaultPools.find(
          (p) =>
            p.address === pool.address ||
            (p.tokenAAddress === pool.tokenAAddress &&
              p.tokenBAddress === pool.tokenBAddress)
        );

        if (matchingPool) {
          // Use metadata from matching pool if available
          return {
            ...pool,
            tokenAMetadata: matchingPool.tokenAMetadata,
            tokenBMetadata: matchingPool.tokenBMetadata,
          };
        }

        return pool;
      });

      setSearchResults(enhancedResults);

      // Fetch metadata for any new tokens found in search results
      const newTokenAddresses = new Set<string>();

      enhancedResults.forEach((pool) => {
        if (pool.tokenAAddress && !pool.tokenAMetadata) {
          newTokenAddresses.add(pool.tokenAAddress);
        }
        if (pool.tokenBAddress && !pool.tokenBMetadata) {
          newTokenAddresses.add(pool.tokenBAddress);
        }
      });

      if (newTokenAddresses.size > 0) {
        const metadata = await birdeyeService.getMultipleTokenMetadata(
          Array.from(newTokenAddresses)
        );

        const updatedResults = enhancedResults.map((pool) => ({
          ...pool,
          tokenAMetadata:
            pool.tokenAMetadata ||
            (pool.tokenAAddress ? metadata[pool.tokenAAddress] : undefined),
          tokenBMetadata:
            pool.tokenBMetadata ||
            (pool.tokenBAddress ? metadata[pool.tokenBAddress] : undefined),
        }));

        setSearchResults(updatedResults);
      }
    } catch (error) {
      console.error("Search failed:", error);
    }
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

  const handleDeposit = (pool: PoolInfo) => {
    if (!wallet.connected) {
      alert("Please connect your Sui wallet to deposit liquidity.");
      return;
    }
    setModalPool(pool);
  };

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
    <div className="p-4">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="w-full sm:w-1/2">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onSubmit={handleSearchSubmit}
            placeholder="🔍 Filter by token or address"
          />
        </div>

        <div className="flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded"
              checked={showIncentivizedOnly}
              onChange={handleToggleIncentivized}
            />
            <span className="text-gray-300">Incentivized only</span>
          </label>
          {loadingMetadata && (
            <span className="ml-4 text-sm text-gray-400">
              Loading token icons...
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading pools...</div>
      ) : (
        <PoolTable
          pools={displayedPools}
          sortColumn={sortColumn}
          sortOrder={sortOrder}
          onSort={handleSortChange}
          onDeposit={handleDeposit}
        />
      )}

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
