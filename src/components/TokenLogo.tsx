import React from "react";

interface TokenLogoProps {
  logoUrl?: string;
  symbol: string;
  size?: "sm" | "md" | "lg";
}

function TokenLogo({ logoUrl, symbol, size = "md" }: TokenLogoProps) {
  // Define fixed dimensions based on size
  const sizeClass =
    size === "sm" ? "w-5 h-5" : size === "lg" ? "w-8 h-8" : "w-6 h-6";

  // If no logo URL is provided, render a text-based fallback with the first letter of the symbol
  if (!logoUrl) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 text-white font-bold`}
        style={{
          minWidth: size === "sm" ? "20px" : size === "lg" ? "32px" : "24px",
        }}
      >
        {symbol ? symbol.charAt(0) : "?"}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} overflow-hidden rounded-full bg-gray-800 flex items-center justify-center border border-gray-700`}
      style={{
        minWidth: size === "sm" ? "20px" : size === "lg" ? "32px" : "24px",
      }}
    >
      <div className="w-full h-full relative flex items-center justify-center">
        <img
          src={logoUrl}
          alt={`${symbol} Logo`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onError={(e) => {
            // If loading the image fails, replace with a text-based fallback
            const parent = e.currentTarget.parentNode
              ?.parentNode as HTMLElement;
            if (parent) {
              // Create a text-based fallback
              parent.innerHTML = `<span class="text-white font-bold">${
                symbol ? symbol.charAt(0) : "?"
              }</span>`;
              parent.style.backgroundColor = "#374151"; // bg-gray-700
            }
          }}
        />
      </div>
    </div>
  );
}

interface PoolPairProps {
  tokenALogo?: string;
  tokenBLogo?: string;
  tokenASymbol: string;
  tokenBSymbol: string;
}

function PoolPair({
  tokenALogo,
  tokenBLogo,
  tokenASymbol,
  tokenBSymbol,
}: PoolPairProps) {
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2 mr-2">
        <div className="z-10 bg-gray-900">
          <TokenLogo logoUrl={tokenALogo} symbol={tokenASymbol} />
        </div>
        <div className="bg-gray-900">
          <TokenLogo logoUrl={tokenBLogo} symbol={tokenBSymbol} />
        </div>
      </div>
      <span>
        {tokenASymbol}/{tokenBSymbol}
      </span>
    </div>
  );
}

export { TokenLogo, PoolPair };
