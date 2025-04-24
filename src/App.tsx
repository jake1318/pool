import React from "react";
import { WalletProvider } from "@suiet/wallet-kit";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ConnectButton } from "@suiet/wallet-kit";
import Home from "./pages/Home";
import Lending from "./pages/Lending";
import Pools from "./pages/Pools";
import Positions from "./pages/Positions";
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
            <Route path="/" element={<Home />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/lending" element={<Lending />} />
            <Route path="/positions" element={<Positions />} />
            {/* Redirect any unknown paths to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </WalletProvider>
  );
};

export default App;
