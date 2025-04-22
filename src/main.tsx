import React from "react";
import ReactDOM from "react-dom/client";
import { WalletProvider } from "@suiet/wallet-kit";
import App from "./App";
import "@suiet/wallet-kit/style.css";
import "./styles/global.scss";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
);
