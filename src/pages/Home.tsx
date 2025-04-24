// src/pages/Home.tsx

import React, { useState } from "react";
import Pools from "./Pools";
import Positions from "./Positions";
import Lending from "./Lending"; // ← New import

type Tab = "Pools" | "Positions" | "Lending";

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Pools");

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
          <button
            className={`tab-button ${activeTab === "Lending" ? "active" : ""}`}
            onClick={() => setActiveTab("Lending")}
          >
            Lending
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
          {activeTab === "Lending" && (
            <button
              className="btn primary"
              onClick={() => alert("Lending market refresh not implemented")}
            >
              Refresh Markets
            </button>
          )}
        </div>
      </div>

      <div className="tab-content">
        {activeTab === "Pools" && <Pools />}
        {activeTab === "Positions" && <Positions />}
        {activeTab === "Lending" && <Lending />}
      </div>
    </div>
  );
};

export default Home;
