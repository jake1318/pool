import React, { useState, useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import * as suilendService from "../services/suilendService";

// Define a type for asset data (reserve info)
interface AssetInfo {
  symbol: string;
  name: string;
  price: number;
  totalDepositsUSD: number;
  totalBorrowsUSD: number;
  depositApr: number;
  borrowApr: number;
  ltv: number; // collateral factor (LTV) as percentage (e.g. 70 for 70%)
  isBorrowable: boolean;
  category: "main" | "isolated";
}

// Define a type for market summary
interface MarketSummary {
  totalDepositsUSD: number;
  totalBorrowsUSD: number;
  totalTvlUSD: number;
}

// Define main component
const Lending: React.FC = () => {
  const wallet = useWallet();
  const [loading, setLoading] = useState<boolean>(true);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [mainSummary, setMainSummary] = useState<MarketSummary | null>(null);
  const [expandMainAssets, setExpandMainAssets] = useState<boolean>(true);
  const [expandIsolatedAssets, setExpandIsolatedAssets] =
    useState<boolean>(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);

  useEffect(() => {
    // Fetch market data on mount
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await suilendService.fetchMarketsData();
        setAssets(data.assets);
        setMainSummary(data.mainMarketSummary);
      } catch (error) {
        console.error("Failed to load Suilend market data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openAssetModal = (asset: AssetInfo) => {
    setSelectedAsset(asset);
  };

  const closeAssetModal = () => {
    setSelectedAsset(null);
  };

  // Separate main market assets vs isolated assets for rendering (if needed)
  const mainAssets = assets.filter((a) => a.category === "main");
  const isolatedAssets = assets.filter((a) => a.category === "isolated");

  return (
    <div className="p-4">
      {" "}
      {/* Container padding (using Tailwind utility classes) */}
      {/* Main Market Summary Card */}
      {mainSummary && (
        <div className="mb-4 bg-neutral-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-500">MAIN MARKET</h2>
          <div className="mt-2 text-gray-300">
            <span className="mr-8">
              Deposits:{" "}
              <strong>${mainSummary.totalDepositsUSD.toLocaleString()}</strong>
            </span>
            <span className="mr-8">
              Borrows:{" "}
              <strong>${mainSummary.totalBorrowsUSD.toLocaleString()}</strong>
            </span>
            <span>
              TVL: <strong>${mainSummary.totalTvlUSD.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      )}
      {/* Table Headers */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-sm">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="py-2 text-left">Asset name</th>
              <th className="py-2 text-right">Deposits</th>
              <th className="py-2 text-right">Borrows</th>
              <th className="py-2 text-right">LTV / BW</th>
              <th className="py-2 text-right">Deposit APR</th>
              <th className="py-2 text-right">Borrow APR</th>
            </tr>
          </thead>
          <tbody className="text-gray-200">
            {/* Main market assets (could include a highlighted asset like sSUI) */}
            {mainAssets.map((asset, idx) => {
              // If the asset is the first main asset and is not borrowable (e.g., sSUI), list it above the category section
              const isSpecialAsset = idx === 0 && !asset.isBorrowable;
              return (
                <React.Fragment key={asset.symbol}>
                  {/* Optionally render Ecosystem LSTs category header before the first normal main asset */}
                  {idx === (isSpecialAsset ? 1 : 0) && (
                    <tr
                      className="cursor-pointer bg-neutral-800 hover:bg-neutral-700"
                      onClick={() => setExpandMainAssets(!expandMainAssets)}
                    >
                      <td className="py-2 pl-2 font-semibold">
                        <div className="flex items-center">
                          <span className="mr-2">
                            {expandMainAssets ? "▾" : "▸"}
                          </span>
                          ECOSYSTEM LSTs{" "}
                          <span className="ml-2 text-gray-400 text-xs">
                            ({mainAssets.length - (isSpecialAsset ? 1 : 0)})
                          </span>
                        </div>
                      </td>
                      <td className="py-2" colSpan={5}>
                        {/* Category summary: could show combined deposits if desired */}
                      </td>
                    </tr>
                  )}
                  {/* If this is a special asset (like sSUI), render it regardless of expandMainAssets */}
                  {isSpecialAsset && (
                    <tr
                      className="cursor-pointer hover:bg-neutral-700"
                      onClick={() => openAssetModal(asset)}
                    >
                      <td className="py-2 pl-4 flex items-center">
                        {/* Asset icon could be rendered here if available */}
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="ml-2 text-gray-400 text-sm">
                          {asset.name}
                        </span>
                        <span className="ml-4 text-gray-500 text-xs">
                          ${asset.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.totalDepositsUSD > 0
                          ? `${asset.totalDepositsUSD.toLocaleString()} ${
                              asset.symbol
                            }`
                          : "--"}
                        <br />
                        <span className="text-gray-400">
                          ${asset.totalDepositsUSD.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right">--</td>
                      <td className="py-2 text-right">{asset.ltv}% / ∞</td>
                      <td className="py-2 text-right">
                        {asset.depositApr.toFixed(2)}%
                        {/* If multiple APR sources, icons could be shown here */}
                      </td>
                      <td className="py-2 text-right">
                        {asset.borrowApr.toFixed(2)}%
                      </td>
                    </tr>
                  )}
                  {/* Render other main assets if category expanded */}
                  {!isSpecialAsset && expandMainAssets && (
                    <tr
                      className="cursor-pointer hover:bg-neutral-700"
                      onClick={() => openAssetModal(asset)}
                    >
                      <td className="py-2 pl-6 flex items-center">
                        {/* Indent under category */}
                        {/* Asset icon and symbol */}
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="ml-2 text-gray-400 text-sm">
                          {asset.name}
                        </span>
                        <span className="ml-4 text-gray-500 text-xs">
                          ${asset.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.totalDepositsUSD.toLocaleString()} {asset.symbol}
                        <br />
                        <span className="text-gray-400">
                          ${asset.totalDepositsUSD.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.totalBorrowsUSD.toLocaleString()} {asset.symbol}
                        <br />
                        <span className="text-gray-400">
                          ${asset.totalBorrowsUSD.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right">{asset.ltv}% / 1</td>
                      <td className="py-2 text-right">
                        {asset.depositApr.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right">
                        {asset.borrowApr >= 0
                          ? `${asset.borrowApr.toFixed(2)}%`
                          : `(${Math.abs(asset.borrowApr).toFixed(2)}%)`}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Isolated Assets category */}
            {isolatedAssets.length > 0 && (
              <>
                <tr
                  className="cursor-pointer bg-neutral-800 hover:bg-neutral-700"
                  onClick={() => setExpandIsolatedAssets(!expandIsolatedAssets)}
                >
                  <td className="py-2 pl-2 font-semibold">
                    <div className="flex items-center">
                      <span className="mr-2">
                        {expandIsolatedAssets ? "▾" : "▸"}
                      </span>
                      ISOLATED ASSETS{" "}
                      <span className="ml-2 text-gray-400 text-xs">
                        ({isolatedAssets.length})
                      </span>
                    </div>
                  </td>
                  <td className="py-2" colSpan={5}></td>
                </tr>
                {expandIsolatedAssets &&
                  isolatedAssets.map((asset) => (
                    <tr
                      key={asset.symbol}
                      className="cursor-pointer hover:bg-neutral-700"
                      onClick={() => openAssetModal(asset)}
                    >
                      <td className="py-2 pl-6 flex items-center">
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="ml-2 text-gray-400 text-sm">
                          {asset.name}
                        </span>
                        <span className="ml-4 text-gray-500 text-xs">
                          ${asset.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.totalDepositsUSD.toLocaleString()} {asset.symbol}
                        <br />
                        <span className="text-gray-400">
                          ${asset.totalDepositsUSD.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {asset.totalBorrowsUSD.toLocaleString()} {asset.symbol}
                        <br />
                        <span className="text-gray-400">
                          ${asset.totalBorrowsUSD.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right">{asset.ltv}% / 1</td>
                      <td className="py-2 text-right">
                        {asset.depositApr.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right">
                        {asset.borrowApr >= 0
                          ? `${asset.borrowApr.toFixed(2)}%`
                          : `(${Math.abs(asset.borrowApr).toFixed(2)}%)`}
                      </td>
                    </tr>
                  ))}
              </>
            )}

            {loading && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-500">
                  Loading assets...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Asset action modal */}
      {selectedAsset && (
        <LendModal asset={selectedAsset} onClose={closeAssetModal} />
      )}
    </div>
  );
};

export default Lending;
