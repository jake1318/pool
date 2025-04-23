// ──────────────────────────────────────────────────────────────────────────────
// src/components/TokenLogo.tsx
// Renders every token logo at a consistent, circular size.
// ──────────────────────────────────────────────────────────────────────────────
import React from "react";

interface TokenLogoProps {
  logoUrl?: string | null;
  symbol: string;
  size?: "sm" | "md" | "lg"; // sm≈20 px, md≈24 px, lg≈32 px
}

/** Fixed dimension utility based on the size prop */
const sizeClass = (size: "sm" | "md" | "lg") =>
  size === "sm"
    ? "w-5 h-5" // 20 px
    : size === "lg"
    ? "w-8 h-8" // 32 px
    : "w-6 h-6"; // 24 px (md)

export const TokenLogo: React.FC<TokenLogoProps> = ({
  logoUrl,
  symbol,
  size = "md",
}) => {
  const classes =
    `${sizeClass(size)} rounded-full overflow-hidden ` +
    `flex items-center justify-center flex-shrink-0 bg-gray-800`;

  // Fallback text (first 1–2 chars) if image missing / fails
  const fallback = (
    <span className="text-white text-xs font-semibold select-none">
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );

  return (
    <div className={classes}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={symbol}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            // graceful degradation → remove broken img, show fallback
            const parent = e.currentTarget.parentNode as HTMLElement;
            if (parent) parent.innerHTML = ""; // clear
          }}
          onLoad={(e) => {
            // if the url 404s some browsers keep empty img; guard by checking naturalWidth
            if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) {
              (e.currentTarget.parentNode as HTMLElement).innerHTML = "";
            }
          }}
        />
      ) : (
        fallback
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Composite helper that shows an LP pair (token A on top of token B)
// ──────────────────────────────────────────────────────────────────────────────
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
