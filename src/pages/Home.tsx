import React, { useState } from "react";
import Pools from "./Pools";
import Positions from "./Positions";

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"Pools" | "Positions">("Pools");

  return (
    <div className="dashboard">
      <div className="tab-header">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === "Pools" ? "active" : ""}`}
            onClick={() => setActiveTab("Pools")}
          >
            Pools
          </button>
          <button
            className={`tab-button ${
              activeTab === "Positions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("Positions")}
          >
            Positions
          </button>
        </div>
        <div className="tab-actions">
          {activeTab === "Pools" && (
            <>
              <button
                className="btn secondary"
                onClick={() => alert("Create Pool feature not implemented")}
              >
                Create a new pool
              </button>
              <button
                className="btn primary"
                onClick={() => alert("Add Liquidity feature not implemented")}
              >
                Add Liquidity
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === "Pools" ? <Pools /> : <Positions />}
    </div>
  );
};

export default Home;
