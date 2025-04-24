import React, { useState, useEffect } from "react";
import "./TransactionNotification.scss";

interface TransactionNotificationProps {
  message: string;
  txDigest?: string;
  isSuccess?: boolean;
  onClose: () => void;
}

const TransactionNotification: React.FC<TransactionNotificationProps> = ({
  message,
  txDigest,
  isSuccess = true,
  onClose,
}) => {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Handle clicking the close button
  const handleClose = () => {
    setVisible(false);
    onClose();
  };

  const shortenDigest = (digest: string) => {
    return `${digest.substring(0, 6)}...${digest.substring(digest.length - 4)}`;
  };

  if (!visible) return null;

  return (
    <div className="notification-overlay">
      <div className={`notification ${isSuccess ? "success" : "error"}`}>
        <div className="notification-content">
          <p className="notification-message">{message}</p>

          {txDigest && (
            <div className="notification-digest">
              <span>Transaction: </span>
              <a
                href={`https://suivision.xyz/txblock/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="digest-link"
              >
                {shortenDigest(txDigest)}
              </a>
            </div>
          )}
        </div>

        <button className="notification-button" onClick={handleClose}>
          OK
        </button>
      </div>
    </div>
  );
};

export default TransactionNotification;
