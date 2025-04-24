import React from "react";
import { WalletProvider } from "@suiet/wallet-kit";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ConnectButton } from "@suiet/wallet-kit";
import Pools from "./pages/Pools";
import Positions from "./pages/Positions"; // Make sure you've created this component
import "./styles/main.scss";

const App: React.FC = () => {
  return (
    <WalletProvider>
      <Router>
        <div className="app min-h-screen bg-black">
          <header className="py-4 px-6 border-b border-gray-800 flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">
              Sui Liquidity Pools
            </h1>
            <ConnectButton />
          </header>

          <Routes>
            <Route path="/" element={<Pools />} />
            <Route path="/positions" element={<Positions />} />
          </Routes>
        </div>
      </Router>
    </WalletProvider>
  );
};

export default App;
