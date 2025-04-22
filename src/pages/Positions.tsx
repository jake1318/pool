import React, { useState, useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import * as cetusService from "../services/cetusService";
import { PoolInfo } from "../services/coinGeckoService";

interface PositionInfo {
  id: string;
  poolAddress: string;
  liquidity: number;
  poolName?: string;
  apr?: number;
  rewardSymbols?: string[];
}

const Positions: React.FC = () => {
  const wallet = useWallet();
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPositionsData = () => {
    if (!wallet.account?.address) return;
    setLoading(true);
    const ownerAddress = wallet.account.address;
    cetusService
      .getPositions(ownerAddress)
      .then(async (posList) => {
        if (posList.length === 0) {
          setPositions([]);
          setLoading(false);
        } else {
          // Fetch pool details for each position to get names and APRs
          const poolAddrs = posList.map((p) => p.poolAddress);
          try {
            const poolDetails: PoolInfo[] =
              await cetusService.getPoolsDetailsForPositions(poolAddrs);
            // Map pool address to details for quick lookup
            const poolMap: Record<string, PoolInfo> = {};
            poolDetails.forEach((pd) => {
              poolMap[pd.address] = pd;
            });
            // Merge pool info into positions
            const merged = posList.map((pos) => ({
              ...pos,
              poolName: poolMap[pos.poolAddress]?.name || pos.poolAddress,
              apr: poolMap[pos.poolAddress]?.apr || 0,
              rewardSymbols: poolMap[pos.poolAddress]?.rewardSymbols || [],
            }));
            setPositions(merged);
          } catch (error) {
            console.error("Failed to fetch pool details for positions:", error);
            setPositions(posList);
          } finally {
            setLoading(false);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load positions:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (wallet.connected) {
      fetchPositionsData();
    } else {
      setPositions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected]);

  const handleWithdraw = (position: PositionInfo) => {
    if (!wallet.connected) return;
    const confirmMsg = `Withdraw all liquidity from ${
      position.poolName || position.poolAddress
    }?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    cetusService
      .withdraw(wallet, position.poolAddress, position.id, position.liquidity)
      .then(() => {
        alert(`Withdrawal transaction submitted for ${position.poolName}!`);
        // Refresh the positions list after withdrawal
        fetchPositionsData();
      })
      .catch((err) => console.error("Withdraw failed:", err));
  };

  const handleClaim = (position: PositionInfo) => {
    if (!wallet.connected) return;
    cetusService
      .claimRewards(wallet, position.poolAddress, position.id)
      .then(() => {
        alert(`Rewards claimed for ${position.poolName}.`);
        // You may refresh positions or update UI if rewards were being displayed
      })
      .catch((err) => console.error("Claim rewards failed:", err));
  };

  if (!wallet.connected) {
    return (
      <div style={{ marginTop: "1rem" }}>
        Connect your wallet to view your liquidity positions.
      </div>
    );
  }

  if (loading) {
    return <div style={{ marginTop: "1rem" }}>Loading positions...</div>;
  }

  if (positions.length === 0) {
    return (
      <div style={{ marginTop: "1rem" }}>You have no liquidity positions.</div>
    );
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Pool</th>
            <th className="numeric">Liquidity</th>
            <th className="numeric">APR ℹ</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id}>
              <td>
                {pos.poolName}
                {/* We could include fee tier or reward tokens if desired */}
              </td>
              <td className="numeric">
                {pos.liquidity.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="numeric">{(pos.apr || 0).toFixed(2)}%</td>
              <td>
                <button
                  className="btn danger"
                  onClick={() => handleWithdraw(pos)}
                >
                  Withdraw
                </button>{" "}
                <button
                  className="btn success"
                  onClick={() => handleClaim(pos)}
                >
                  Claim
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Positions;
