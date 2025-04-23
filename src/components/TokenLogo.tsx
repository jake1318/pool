import React from "react";

interface TokenLogoProps {
  logoUrl?: string | null;
  symbol: string;
  size?: "sm" | "md" | "lg";
}

export const TokenLogo: React.FC<TokenLogoProps> = ({
  logoUrl,
  symbol,
  size = "md",
}) => {
  const logoClass =
    size === "sm"
      ? "token-logo-sm"
      : size === "lg"
      ? "token-logo-lg"
      : "token-logo";
  return (
    <div className={logoClass}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={symbol}
          loading="lazy"
          onError={(e) => {
            const parent = e.currentTarget.parentNode as HTMLElement;
            if (parent) parent.innerHTML = "";
          }}
          onLoad={(e) => {
            if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) {
              (e.currentTarget.parentNode as HTMLElement).innerHTML = "";
            }
          }}
        />
      ) : null}
    </div>
  );
};

// Composite helper that shows an LP pair (token A on top of token B)
interface PoolPairProps {
  tokenALogo?: string | null;
  tokenBLogo?: string | null;
  tokenASymbol: string;
  tokenBSymbol: string;
}

export const PoolPair: React.FC<PoolPairProps> = ({
  tokenALogo,
  tokenBLogo,
  tokenASymbol,
  tokenBSymbol,
}) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Stacked / overlapped logos */}
      <div className="flex -space-x-2">
        <TokenLogo logoUrl={tokenALogo} symbol={tokenASymbol} size="lg" />
        <TokenLogo logoUrl={tokenBLogo} symbol={tokenBSymbol} size="lg" />
      </div>
      {/* Pair label */}
      <span className="whitespace-nowrap">
        {tokenASymbol}/{tokenBSymbol}
      </span>
    </div>
  );
};
