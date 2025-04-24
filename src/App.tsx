import React from "react";
import { ConnectButton } from "@suiet/wallet-kit";
import Pools from "./pages/Pools"; // Import the Pools component
import "./styles/main.scss";

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Sui Liquidity Pools</h1>
        <ConnectButton />
      </header>
      <main>
        <Pools /> {/* Use the Pools component here instead of Home */}
      </main>
    </div>
  );
};

export default App;
