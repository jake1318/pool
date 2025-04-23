import { useEffect, useState } from "react";
import { useWallet } from "@suiet/wallet-kit";
import * as cetusService from "../services/cetusService";
import * as blockVisionService from "../services/blockVisionService";
import { NormalizedPosition, PoolGroup } from "../services/blockVisionService";
import WithdrawModal from "../components/WithdrawModal";
import { formatLargeNumber, formatDollars } from "../utils/formatters";

interface WithdrawModalState {
  isOpen: boolean;
  poolAddress: string;
  positionIds: string[];
  totalLiquidity: number;
  valueUsd: number;
}

interface RewardsModalState {
  isOpen: boolean;
  poolAddress: string;
  poolName: string;
  positions: NormalizedPosition[];
  totalRewards: blockVisionService.RewardInfo[];
}

// Default placeholder image for tokens without logos
const DEFAULT_TOKEN_LOGO = "https://via.placeholder.com/40?text=?";

function TokenLogo({
  logoUrl,
  symbol,
  size = "md",
}: {
  logoUrl?: string;
  symbol: string;
  size?: "sm" | "md" | "lg";
}) {
  // Define strict pixel dimensions based on size
  const dimensions = size === "sm" ? 20 : size === "lg" ? 32 : 24;

  return (
    <div
      className="rounded-full bg-gray-800 overflow-hidden flex items-center justify-center"
      style={{
        width: `${dimensions}px`,
        height: `${dimensions}px`,
        minWidth: `${dimensions}px`,
        minHeight: `${dimensions}px`,
        maxWidth: `${dimensions}px`,
        maxHeight: `${dimensions}px`,
      }}
    >
      <img
        src={logoUrl || DEFAULT_TOKEN_LOGO}
        alt={`${symbol} Logo`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        onError={(e) => {
          // If loading the image fails, use the default
          e.currentTarget.onerror = null;
          e.currentTarget.src = DEFAULT_TOKEN_LOGO;
        }}
      />
    </div>
  );
}

function PoolPair({
  tokenALogo,
  tokenBLogo,
  tokenASymbol,
  tokenBSymbol,
}: {
  tokenALogo?: string;
  tokenBLogo?: string;
  tokenASymbol: string;
  tokenBSymbol: string;
}) {
  return (
    <div className="flex items-center">
      <div className="flex mr-2" style={{ marginRight: "10px" }}>
        <div className="z-10" style={{ marginRight: "-8px" }}>
          <TokenLogo logoUrl={tokenALogo} symbol={tokenASymbol} />
        </div>
        <div>
          <TokenLogo logoUrl={tokenBLogo} symbol={tokenBSymbol} />
        </div>
      </div>
      <span>
        {tokenASymbol}/{tokenBSymbol}
      </span>
    </div>
  );
}

function Positions() {
  const wallet = useWallet();
  const { account, connected } = wallet;
  const [poolPositions, setPoolPositions] = useState<PoolGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<WithdrawModalState>({
    isOpen: false,
    poolAddress: "",
    positionIds: [],
    totalLiquidity: 0,
    valueUsd: 0,
  });
  const [rewardsModal, setRewardsModal] = useState<RewardsModalState>({
    isOpen: false,
    poolAddress: "",
    poolName: "",
    positions: [],
    totalRewards: [],
  });
  const [claimingPool, setClaimingPool] = useState<string | null>(null);
  const [withdrawingPool, setWithdrawingPool] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  // Load user positions when wallet connects
  useEffect(() => {
    const loadPositions = async () => {
      if (connected && account?.address) {
        setLoading(true);
        setError(null);
        try {
          // Get positions from BlockVision
          const blockVisionPositions =
            await blockVisionService.getDefiPortfolio(account.address);

          if (blockVisionPositions.length > 0) {
            setPoolPositions(blockVisionPositions);
          } else {
            // Fallback to Cetus SDK
            console.log("No BlockVision data, falling back to Cetus SDK");
            const rawPositions = await cetusService.getPositions(
              account.address
            );

            // Simple fallback implementation - in a real app, you'd want to provide
            // more of the data that BlockVision would normally provide
            const fallbackPoolGroups: PoolGroup[] = [];
            // Implementation omitted for brevity

            setPoolPositions(fallbackPoolGroups);
          }
        } catch (error) {
          console.error("Error loading positions:", error);
          setError("Failed to load your positions. Please try again later.");
        } finally {
          setLoading(false);
        }
      }
    };

    loadPositions();
  }, [connected, account]);

  // Toggle details for a pool
  const toggleDetails = (poolAddress: string) => {
    setShowDetails((prev) => ({
      ...prev,
      [poolAddress]: !prev[poolAddress],
    }));
  };

  // Reload positions
  const reloadPositions = async () => {
    if (connected && account?.address) {
      setLoading(true);
      try {
        const blockVisionPositions = await blockVisionService.getDefiPortfolio(
          account.address
        );
        if (blockVisionPositions.length > 0) {
          setPoolPositions(blockVisionPositions);
        } else {
          // Fallback implementation
          setPoolPositions([]);
        }
        setError(null);
      } catch (error) {
        console.error("Error reloading positions:", error);
        setError("Failed to reload positions.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle withdraw action
  const handleWithdraw = (
    poolAddress: string,
    positionIds: string[],
    totalLiquidity: number,
    valueUsd: number
  ) => {
    setWithdrawModal({
      isOpen: true,
      poolAddress,
      positionIds,
      totalLiquidity,
      valueUsd,
    });
  };

  // Open rewards detail modal
  const handleViewRewards = (poolGroup: PoolGroup) => {
    // Aggregate rewards across all positions
    const allRewards: Record<string, blockVisionService.RewardInfo> = {};

    poolGroup.positions.forEach((position) => {
      position.rewards.forEach((reward) => {
        if (!allRewards[reward.tokenSymbol]) {
          allRewards[reward.tokenSymbol] = {
            ...reward,
            amount: "0",
            formatted: "0",
            valueUsd: 0,
          };
        }

        // Add this position's rewards to the total
        const currentAmount = BigInt(allRewards[reward.tokenSymbol].amount);
        const positionAmount = BigInt(reward.amount);
        const newAmount = (currentAmount + positionAmount).toString();

        // Update the formatted amount
        const newFormatted = (
          parseInt(newAmount) / Math.pow(10, reward.decimals)
        ).toFixed(reward.decimals);

        allRewards[reward.tokenSymbol] = {
          ...allRewards[reward.tokenSymbol],
          amount: newAmount,
          formatted: newFormatted,
          valueUsd: allRewards[reward.tokenSymbol].valueUsd + reward.valueUsd,
        };
      });
    });

    setRewardsModal({
      isOpen: true,
      poolAddress: poolGroup.poolAddress,
      poolName: poolGroup.poolName,
      positions: poolGroup.positions,
      totalRewards: Object.values(allRewards),
    });
  };

  // Handle claim action
  const handleClaim = async (poolAddress: string, positionIds: string[]) => {
    if (!connected) return;

    try {
      setClaimingPool(poolAddress);

      // For each position, claim rewards
      for (const positionId of positionIds) {
        try {
          await cetusService.collectRewards(wallet, poolAddress, positionId);
        } catch (error) {
          console.error(
            `Error claiming rewards for position ${positionId}:`,
            error
          );
          // Continue with next position
        }
      }

      // Reload positions after claiming
      await reloadPositions();
    } catch (error) {
      console.error("Error claiming rewards:", error);
      alert("Failed to claim rewards. See console for details.");
    } finally {
      setClaimingPool(null);
    }
  };

  // Handle withdraw modal confirm
  const handleWithdrawConfirm = async () => {
    if (!connected) return;

    try {
      setWithdrawingPool(withdrawModal.poolAddress);

      // For each position, remove liquidity
      for (const positionId of withdrawModal.positionIds) {
        try {
          await cetusService.removeLiquidity(
            wallet,
            withdrawModal.poolAddress,
            positionId,
            100 // 100% of liquidity
          );
        } catch (error) {
          console.error(
            `Error removing liquidity for position ${positionId}:`,
            error
          );
          // Continue with next position
        }
      }

      // Close modal
      setWithdrawModal({
        isOpen: false,
        poolAddress: "",
        positionIds: [],
        totalLiquidity: 0,
        valueUsd: 0,
      });

      // Reload positions
      await reloadPositions();
    } catch (error) {
      console.error("Error withdrawing:", error);
      alert("Failed to withdraw. See console for details.");
    } finally {
      setWithdrawingPool(null);
    }
  };

  // Handle withdraw modal close
  const handleWithdrawClose = () => {
    setWithdrawModal({
      isOpen: false,
      poolAddress: "",
      positionIds: [],
      totalLiquidity: 0,
      valueUsd: 0,
    });
  };

  // Handle rewards modal close
  const handleRewardsClose = () => {
    setRewardsModal({
      isOpen: false,
      poolAddress: "",
      poolName: "",
      positions: [],
      totalRewards: [],
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Your Liquidity Positions</h2>

      {loading ? (
        <div className="text-center py-10">Loading positions...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">
          {error}
          <button
            className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={reloadPositions}
          >
            Retry
          </button>
        </div>
      ) : poolPositions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          You don't have any liquidity positions.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4">Pool</th>
                <th className="text-right py-3 px-4">Liquidity</th>
                <th className="text-right py-3 px-4">APR</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {poolPositions.map((poolPosition) => (
                <>
                  <tr
                    key={poolPosition.poolAddress}
                    className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleDetails(poolPosition.poolAddress)}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium">
                        <PoolPair
                          tokenALogo={poolPosition.tokenAMetadata?.logo_uri}
                          tokenBLogo={poolPosition.tokenBMetadata?.logo_uri}
                          tokenASymbol={poolPosition.tokenA}
                          tokenBSymbol={poolPosition.tokenB}
                        />
                      </div>
                      <div className="text-sm text-gray-400 flex flex-col mt-1 ml-10">
                        <span>
                          {poolPosition.positions.length} position
                          {poolPosition.positions.length !== 1 ? "s" : ""}
                        </span>
                        <span>{poolPosition.protocol}</span>
                      </div>
                    </td>
                    <td className="text-right py-4 px-4">
                      <div className="font-medium">
                        {formatDollars(poolPosition.totalValueUsd)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatLargeNumber(poolPosition.totalLiquidity)}{" "}
                        liquidity
                      </div>
                    </td>
                    <td className="text-right py-4 px-4">
                      <div className="font-medium">
                        {poolPosition.apr.toFixed(2)}%
                      </div>
                      {poolPosition.positions.some((pos) =>
                        pos.rewards.some((r) => parseFloat(r.formatted) > 0)
                      ) && (
                        <div className="text-sm text-green-400">
                          Rewards available
                        </div>
                      )}
                    </td>
                    <td className="text-right py-4 px-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRewards(poolPosition);
                          }}
                        >
                          Details
                        </button>
                        <button
                          className={`px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition ${
                            withdrawingPool === poolPosition.poolAddress
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWithdraw(
                              poolPosition.poolAddress,
                              poolPosition.positions.map((p) => p.id),
                              poolPosition.totalLiquidity,
                              poolPosition.totalValueUsd
                            );
                          }}
                          disabled={
                            withdrawingPool === poolPosition.poolAddress
                          }
                        >
                          {withdrawingPool === poolPosition.poolAddress
                            ? "Withdrawing..."
                            : "Withdraw"}
                        </button>
                        <button
                          className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition ${
                            claimingPool === poolPosition.poolAddress
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClaim(
                              poolPosition.poolAddress,
                              poolPosition.positions.map((p) => p.id)
                            );
                          }}
                          disabled={claimingPool === poolPosition.poolAddress}
                        >
                          {claimingPool === poolPosition.poolAddress
                            ? "Claiming..."
                            : "Claim"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {showDetails[poolPosition.poolAddress] && (
                    <tr className="bg-gray-900">
                      <td colSpan={4} className="p-4">
                        <div className="text-lg font-semibold mb-2">
                          Position Details
                        </div>

                        {/* Position details table */}
                        <table className="w-full border-collapse border-gray-700">
                          <thead>
                            <tr className="bg-gray-800">
                              <th className="text-left p-2">Position ID</th>
                              <th className="text-right p-2">
                                <div className="flex items-center justify-end">
                                  <TokenLogo
                                    logoUrl={
                                      poolPosition.tokenAMetadata?.logo_uri
                                    }
                                    symbol={poolPosition.tokenA}
                                    size="sm"
                                  />
                                  <span className="ml-1">
                                    {poolPosition.tokenA}
                                  </span>
                                </div>
                              </th>
                              <th className="text-right p-2">
                                <div className="flex items-center justify-end">
                                  <TokenLogo
                                    logoUrl={
                                      poolPosition.tokenBMetadata?.logo_uri
                                    }
                                    symbol={poolPosition.tokenB}
                                    size="sm"
                                  />
                                  <span className="ml-1">
                                    {poolPosition.tokenB}
                                  </span>
                                </div>
                              </th>
                              <th className="text-right p-2">Value (USD)</th>
                              <th className="text-right p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poolPosition.positions.map((position) => (
                              <tr
                                key={position.id}
                                className="border-t border-gray-700"
                              >
                                <td className="p-2 text-gray-300">
                                  {position.id.substring(0, 8)}...
                                  {position.id.substring(
                                    position.id.length - 4
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  {formatLargeNumber(
                                    parseInt(position.balanceA)
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  {formatLargeNumber(
                                    parseInt(position.balanceB)
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  {formatDollars(position.valueUsd)}
                                </td>
                                <td className="p-2 text-right">
                                  {position.isOutOfRange ? (
                                    <span className="text-red-500">
                                      Out of Range
                                    </span>
                                  ) : (
                                    <span className="text-green-500">
                                      In Range
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Rewards section if any */}
                        {poolPosition.positions.some((pos) =>
                          pos.rewards.some((r) => parseFloat(r.formatted) > 0)
                        ) && (
                          <div className="mt-4">
                            <div className="text-lg font-semibold mb-2">
                              Unclaimed Rewards
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.values(
                                poolPosition.positions
                                  .flatMap((pos) => pos.rewards)
                                  .reduce((acc, reward) => {
                                    const key = reward.tokenSymbol;
                                    if (!acc[key]) {
                                      acc[key] = { ...reward };
                                    } else {
                                      // Add amounts
                                      const currentAmount = BigInt(
                                        acc[key].amount
                                      );
                                      const newAmount = BigInt(reward.amount);
                                      acc[key].amount = (
                                        currentAmount + newAmount
                                      ).toString();
                                      acc[key].formatted = (
                                        parseInt(acc[key].amount) /
                                        Math.pow(10, reward.decimals)
                                      ).toFixed(reward.decimals);
                                      acc[key].valueUsd += reward.valueUsd;
                                    }
                                    return acc;
                                  }, {} as Record<string, blockVisionService.RewardInfo>)
                              )
                                .filter(
                                  (reward) => parseFloat(reward.formatted) > 0
                                )
                                .map((reward) => (
                                  <div
                                    key={reward.tokenSymbol}
                                    className="bg-gray-800 rounded p-3 flex items-center"
                                  >
                                    <TokenLogo
                                      logoUrl={reward.metadata?.logo_uri}
                                      symbol={reward.tokenSymbol}
                                    />
                                    <div className="ml-2">
                                      <div className="font-medium">
                                        {reward.tokenSymbol}
                                      </div>
                                      <div className="text-gray-300">
                                        {parseFloat(reward.formatted).toFixed(
                                          6
                                        )}
                                      </div>
                                      <div className="text-gray-400 text-sm">
                                        {formatDollars(reward.valueUsd)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Fees section if any */}
                        {poolPosition.positions.some(
                          (pos) =>
                            parseInt(pos.fees.amountA) > 0 ||
                            parseInt(pos.fees.amountB) > 0
                        ) && (
                          <div className="mt-4">
                            <div className="text-lg font-semibold mb-2">
                              Unclaimed Fees
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {poolPosition.positions.some(
                                (pos) => parseInt(pos.fees.amountA) > 0
                              ) && (
                                <div className="bg-gray-800 rounded p-3 flex items-center">
                                  <TokenLogo
                                    logoUrl={
                                      poolPosition.tokenAMetadata?.logo_uri
                                    }
                                    symbol={poolPosition.tokenA}
                                  />
                                  <div className="ml-2">
                                    <div className="font-medium">
                                      {poolPosition.tokenA}
                                    </div>
                                    <div className="text-gray-300">
                                      {formatLargeNumber(
                                        poolPosition.positions.reduce(
                                          (sum, pos) =>
                                            sum + parseInt(pos.fees.amountA),
                                          0
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {poolPosition.positions.some(
                                (pos) => parseInt(pos.fees.amountB) > 0
                              ) && (
                                <div className="bg-gray-800 rounded p-3 flex items-center">
                                  <TokenLogo
                                    logoUrl={
                                      poolPosition.tokenBMetadata?.logo_uri
                                    }
                                    symbol={poolPosition.tokenB}
                                  />
                                  <div className="ml-2">
                                    <div className="font-medium">
                                      {poolPosition.tokenB}
                                    </div>
                                    <div className="text-gray-300">
                                      {formatLargeNumber(
                                        poolPosition.positions.reduce(
                                          (sum, pos) =>
                                            sum + parseInt(pos.fees.amountB),
                                          0
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={withdrawModal.isOpen}
        onClose={handleWithdrawClose}
        onConfirm={handleWithdrawConfirm}
        liquidity={withdrawModal.totalLiquidity}
        valueUsd={withdrawModal.valueUsd}
      />

      {/* Rewards Detail Modal */}
      {rewardsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-75">
          <div className="w-full max-w-lg bg-gray-900 rounded-lg shadow-lg p-6 m-4">
            <h3 className="text-lg font-medium text-white mb-4">
              <PoolPair
                tokenALogo={
                  poolPositions.find(
                    (p) => p.poolAddress === rewardsModal.poolAddress
                  )?.tokenAMetadata?.logo_uri
                }
                tokenBLogo={
                  poolPositions.find(
                    (p) => p.poolAddress === rewardsModal.poolAddress
                  )?.tokenBMetadata?.logo_uri
                }
                tokenASymbol={rewardsModal.poolName.split("/")[0]}
                tokenBSymbol={rewardsModal.poolName.split("/")[1]}
              />
              <div className="text-sm text-gray-400 ml-10 mt-1">
                Rewards Details
              </div>
            </h3>

            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">
                Total Unclaimed Rewards
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                {rewardsModal.totalRewards
                  .filter((reward) => parseFloat(reward.formatted) > 0)
                  .map((reward) => (
                    <div
                      key={reward.tokenSymbol}
                      className="bg-gray-800 rounded p-3 flex items-center"
                    >
                      <TokenLogo
                        logoUrl={reward.metadata?.logo_uri}
                        symbol={reward.tokenSymbol}
                        size="lg"
                      />
                      <div className="ml-3">
                        <div className="font-medium">{reward.tokenSymbol}</div>
                        <div className="text-xl">
                          {parseFloat(reward.formatted).toFixed(6)}
                        </div>
                        {reward.valueUsd > 0 && (
                          <div className="text-sm text-gray-400">
                            {formatDollars(reward.valueUsd)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {rewardsModal.totalRewards.length === 0 && (
                  <div className="col-span-3 text-gray-400 text-center p-4">
                    No unclaimed rewards
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                onClick={handleRewardsClose}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                onClick={() => {
                  handleClaim(
                    rewardsModal.poolAddress,
                    rewardsModal.positions.map((p) => p.id)
                  );
                  handleRewardsClose();
                }}
              >
                Claim All Rewards
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Positions;
