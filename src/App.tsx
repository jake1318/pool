import React from "react";
import { ConnectButton } from "@suiet/wallet-kit";
import Home from "./pages/Home";

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Sui Liquidity Pools</h1>
        <ConnectButton />
      </header>
      <Home />
    </div>
  );
};

export default App;
