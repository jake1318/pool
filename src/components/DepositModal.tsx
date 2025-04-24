import React, { useState, useEffect } from "react";
import { PoolInfo } from "../services/coinGeckoService";
import { TokenLogo } from "./TokenLogo";
import "../styles/components/Modals.scss";

interface DepositModalProps {
  pool: PoolInfo;
  onConfirm: (amountA: number, amountB: number) => void;
  onClose: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({
  pool,
  onConfirm,
  onClose,
}) => {
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");

  // Reset amounts when the modal opens with a new pool
  useEffect(() => {
    setAmountA("");
    setAmountB("");
    console.log("DepositModal rendered for pool:", pool.name);
  }, [pool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numA = parseFloat(amountA);
    const numB = parseFloat(amountB);
    if (isNaN(numA) || isNaN(numB) || numA <= 0 || numB <= 0) {
      alert("Please enter valid amounts for both tokens.");
      return;
    }
    onConfirm(numA, numB);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Deposit Liquidity</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-inputs">
            <div className="input-group">
              <label>
                <div className="flex items-center">
                  <TokenLogo
                    logoUrl={pool.tokenAMetadata?.logo_uri}
                    symbol={pool.tokenA}
                    size="sm"
                  />
                  <span className="ml-2">{pool.tokenA} Amount</span>
                </div>
              </label>
              <input
                type="number"
                step="any"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder={`Enter ${pool.tokenA} amount`}
                required
              />
            </div>
            <div className="input-group">
              <label>
                <div className="flex items-center">
                  <TokenLogo
                    logoUrl={pool.tokenBMetadata?.logo_uri}
                    symbol={pool.tokenB}
                    size="sm"
                  />
                  <span className="ml-2">{pool.tokenB} Amount</span>
                </div>
              </label>
              <input
                type="number"
                step="any"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder={`Enter ${pool.tokenB} amount`}
                required
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm">
              Deposit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepositModal;
