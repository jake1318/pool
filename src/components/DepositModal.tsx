import React, { useState, useMemo } from "react";
import type { PoolInfo } from "../services/coinGeckoService";

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
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  // Try to pull symbolA / symbolB out of pool.name (e.g. "USDC / SUI 0.25%" → ["USDC","SUI"])
  const [symbolA, symbolB] = useMemo(() => {
    const slashIdx = pool.name.indexOf("/");
    if (slashIdx !== -1) {
      const left = pool.name.slice(0, slashIdx).trim();
      const right = pool.name
        .slice(slashIdx + 1)
        .trim()
        .split(" ")[0]; // drop the fee part after the token
      return [left, right];
    }
    return ["TokenA", "TokenB"];
  }, [pool.name]);

  const handleSubmit = () => {
    const a = parseFloat(amountA);
    const b = parseFloat(amountB);
    if (isNaN(a) || isNaN(b)) {
      alert("Please enter valid numeric amounts for both tokens.");
      return;
    }
    onConfirm(a, b);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Deposit into {pool.name}</h2>
        <div className="modal-inputs">
          <div className="input-group">
            <label>Amount {symbolA}</label>
            <input
              type="number"
              placeholder={`e.g. 100.0`}
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Amount {symbolB}</label>
            <input
              type="number"
              placeholder={`e.g. 50.0`}
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={handleSubmit}>
            Deposit
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
