// server.js
import express from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import cors from "cors";
import dotenv from "dotenv";
import searchRouter from "./routes/search.js";
import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
  OnChainCalls,
  QueryChain,
  TickMath,
  ClmmPoolUtil,
} from "@firefly-exchange/library-sui/dist/src/spot";
import BN from "bn.js";
import Decimal from "decimal.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const BIRDEYE_KEY = process.env.VITE_BIRDEYE_API_KEY;

if (!BIRDEYE_KEY) {
  console.error("⚠️  Missing VITE_BIRDEYE_API_KEY in .env");
  process.exit(1);
}

// Enhanced error logging middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    console.log(
      `Response for ${req.method} ${req.path}:`,
      typeof data === "string" && data.length > 500
        ? data.substring(0, 500) + "..."
        : data
    );
    return originalSend.call(this, data);
  };
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// Bluefin mainnet configuration
const BLUEFIN_CONFIG = {
  GlobalConfig: "0x03db251ba509a8d5d8777b6338dedf237b319ffee2710d6782ff51c352",
  ProtocolFeeCap: "0x55697473304e901372020f30d9feffce83295d2",
  Display: "0x5f34ee74e113d74ae9546695a23c6725d54ab",
  AdminCap: "0xc5e736b21175e1f8121d58b74afeba8d8b9",
  UpgradeCap: "0xd5b2d2159a78030e6f07e028eb502079c0d",
  Publisher: "0xd9810c5d1ec5d13eac8a70a05bb17767",
  BasePackage: "0x3492c874c1e3b3e2984e8c41bd7c89c267",
  CurrentPackage: "0x6c796c3ab3421a68158e0df18988711b",
};

// Initialize Bluefin client
let suiClient, queryChain;
try {
  suiClient = new SuiClient({
    url: process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
  });
  queryChain = new QueryChain(suiClient);
  console.log("Bluefin client initialized successfully");
} catch (error) {
  console.error("Failed to initialize Bluefin client:", error);
}

// Common token decimals mapping
const COMMON_DECIMALS = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  BTC: 8,
  ETH: 8,
  WETH: 8,
  CETUS: 9,
  BLUE: 9,
  DEEP: 8,
};

// rate‑limit to 15 requests per second
const birdeyeLimiter = rateLimit({
  windowMs: 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests to Birdeye" },
});

// shared axios client for Birdeye
const birdeye = axios.create({
  baseURL: BIRDEYE_BASE,
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": BIRDEYE_KEY,
  },
});

app.use(cors());
app.use(express.json());

// mount the Birdeye proxy under /api
app.use("/api", birdeyeLimiter);

// **mount search under `/api/search`**
app.use("/api/search", searchRouter);

/**
 * Forwards the incoming request to Birdeye under the same query params + x‑chain header
 */
async function forwardToBirdeye(req, res, birdeyePath) {
  const chain = req.header("x-chain") || "sui";
  try {
    const response = await birdeye.get(birdeyePath, {
      headers: { "x-chain": chain },
      params: req.query,
    });
    return res.json(response.data);
  } catch (err) {
    if (err.response?.data) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

// proxy endpoints
app.get("/api/token_trending", (req, res) =>
  forwardToBirdeye(req, res, "/defi/token_trending")
);
app.get("/api/price_volume/single", (req, res) =>
  forwardToBirdeye(req, res, "/defi/price_volume/single")
);
app.get("/api/tokenlist", (req, res) =>
  forwardToBirdeye(req, res, "/defi/tokenlist")
);
app.get("/api/ohlcv", (req, res) => forwardToBirdeye(req, res, "/defi/ohlcv"));
app.get("/api/history_price", (req, res) =>
  forwardToBirdeye(req, res, "/defi/history_price")
);

// ==================== BLUEFIN API ENDPOINTS ====================

/**
 * Helper function to guess token decimals based on symbol
 */
function guessTokenDecimals(symbol) {
  if (!symbol) return 9;

  // Default fallbacks by token name
  for (const [knownSymbol, decimals] of Object.entries(COMMON_DECIMALS)) {
    if (symbol.toLowerCase().includes(knownSymbol.toLowerCase())) {
      return decimals;
    }
  }

  // Default fallback
  return 9;
}

/**
 * Convert amount to smallest unit based on token decimals
 */
function toBaseUnit(amount, decimals) {
  const multiplier = Math.pow(10, decimals);
  const baseAmount = Math.round(amount * multiplier);
  return baseAmount.toString();
}

// Middleware to handle async errors in Bluefin routes
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("Bluefin API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred processing your request",
    });
  });
};

// GET API status check
app.get("/api/bluefin/status", (req, res) => {
  res.json({
    success: true,
    message: "Bluefin API is operational",
    clientInitialized: !!queryChain,
  });
});

// GET Pool Information
app.get(
  "/api/bluefin/pools/:poolId",
  asyncHandler(async (req, res) => {
    const { poolId } = req.params;

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Fetching pool info for ${poolId}`);
      const pool = await queryChain.getPool(poolId);
      console.log(`Successfully fetched pool info for ${poolId}`);
      res.json({ success: true, data: pool });
    } catch (error) {
      console.error(`Error getting pool ${poolId}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to get pool: ${error.message}`,
      });
    }
  })
);

// GET User Positions
app.get(
  "/api/bluefin/positions/:address",
  asyncHandler(async (req, res) => {
    const { address } = req.params;

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Fetching positions for ${address}`);
      const positions = await queryChain.getUserPositions(address);

      // Map to consistent format
      const formattedPositions = positions.map((position) => ({
        id: position.position_id,
        poolAddress: position.pool_id,
        liquidity: Number(position.liquidity) || 0,
      }));

      console.log(
        `Found ${formattedPositions.length} positions for ${address}`
      );
      res.json({ success: true, data: formattedPositions });
    } catch (error) {
      console.error(`Error getting positions for ${address}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to get positions: ${error.message}`,
      });
    }
  })
);

// GET Position Details
app.get(
  "/api/bluefin/position/:positionId",
  asyncHandler(async (req, res) => {
    const { positionId } = req.params;

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Fetching details for position ${positionId}`);
      const position = await queryChain.getPositionDetails(positionId);
      console.log(`Successfully fetched details for position ${positionId}`);
      res.json({ success: true, data: position });
    } catch (error) {
      console.error(`Error getting position details for ${positionId}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to get position details: ${error.message}`,
      });
    }
  })
);

// GET Accrued Fees and Rewards
app.get(
  "/api/bluefin/fees/:positionId",
  asyncHandler(async (req, res) => {
    const { positionId } = req.params;

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Fetching fees for position ${positionId}`);
      const fees = await queryChain.getAccruedFeeAndRewards(positionId);
      console.log(`Successfully fetched fees for position ${positionId}`);
      res.json({ success: true, data: fees });
    } catch (error) {
      console.error(`Error getting fees for position ${positionId}:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to get fees: ${error.message}`,
      });
    }
  })
);

// POST Prepare Add Liquidity Transaction
app.post("/api/bluefin/prepare-add-liquidity", async (req, res) => {
  const { poolId, amountA, amountB, decimalsA, decimalsB } = req.body;

  if (!poolId || amountA === undefined || amountB === undefined) {
    return res.status(400).json({
      success: false,
      error:
        "Missing required parameters: poolId, amountA, and amountB are required",
    });
  }

  if (!queryChain) {
    return res.status(500).json({
      success: false,
      error: "Bluefin client not initialized",
    });
  }

  try {
    console.log(
      `Preparing add liquidity for pool ${poolId} with amounts: ${amountA} and ${amountB}`
    );

    // Try to get pool information if possible, but don't fail if we can't
    let actualDecimalsA = decimalsA;
    let actualDecimalsB = decimalsB;

    try {
      // Get pool information
      const pool = await queryChain.getPool(poolId);
      console.log("Pool information retrieved:", pool.pool_id);

      // Get decimals from pool if not provided
      if (!actualDecimalsA) {
        actualDecimalsA =
          pool.coin_a?.decimals || guessTokenDecimals(pool.coin_a?.symbol);
      }
      if (!actualDecimalsB) {
        actualDecimalsB =
          pool.coin_b?.decimals || guessTokenDecimals(pool.coin_b?.symbol);
      }
    } catch (poolError) {
      console.warn(
        "Could not fetch pool info, using provided or default decimals:",
        poolError.message
      );
      // Fall back to provided decimals or guess from symbols if available
      actualDecimalsA = actualDecimalsA || 9;
      actualDecimalsB = actualDecimalsB || 9;
    }

    console.log(
      `Using decimals: ${actualDecimalsA} for token A and ${actualDecimalsB} for token B`
    );

    const baseAmountA = toBaseUnit(parseFloat(amountA), actualDecimalsA);
    const baseAmountB = toBaseUnit(parseFloat(amountB), actualDecimalsB);

    // Prepare simplified payload that doesn't depend on complex calculations
    const txPayload = {
      target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::add_liquidity`,
      arguments: [
        poolId,
        baseAmountA,
        baseAmountB,
        "50", // 0.5% slippage in basis points
      ],
    };

    console.log("Transaction payload prepared successfully");

    // Send back a simpler response
    return res.json({
      success: true,
      data: {
        txPayload,
        baseAmountA,
        baseAmountB,
      },
    });
  } catch (error) {
    console.error("Error preparing add liquidity transaction:", error);

    // Ensure we return a valid JSON response even when errors occur
    return res.status(500).json({
      success: false,
      error: `Failed to prepare add liquidity transaction: ${
        error.message || "Unknown error"
      }`,
    });
  }
});

// POST Prepare Remove Liquidity Transaction
app.post(
  "/api/bluefin/prepare-remove-liquidity",
  asyncHandler(async (req, res) => {
    const { poolId, positionId, liquidityPercent = 100 } = req.body;

    if (!poolId || !positionId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: poolId and positionId are required",
      });
    }

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(
        `Preparing remove ${liquidityPercent}% liquidity for position ${positionId}`
      );

      // Try to get position details, but provide a fallback
      let liquidityToRemove = "0";
      try {
        // Get position details
        const position = await queryChain.getPositionDetails(positionId);
        console.log(`Position details retrieved for ${positionId}`);

        // Calculate liquidity to remove
        const totalLiquidity = BigInt(position.liquidity || "0");
        liquidityToRemove = (
          (totalLiquidity * BigInt(liquidityPercent)) /
          BigInt(100)
        ).toString();
      } catch (positionError) {
        console.warn(
          "Could not fetch position details:",
          positionError.message
        );
        // Fallback - provide a simple payload without liquidity calculation
        liquidityToRemove = liquidityPercent.toString();
      }

      // Prepare the transaction payload
      const txPayload = {
        target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::remove_liquidity_percentage`,
        arguments: [
          poolId,
          positionId,
          liquidityPercent.toString(),
          "100", // 1% slippage in basis points
        ],
      };

      res.json({
        success: true,
        data: {
          txPayload,
          liquidityToRemove,
          slippage: 100,
        },
      });
    } catch (error) {
      console.error("Error preparing remove liquidity transaction:", error);
      res.status(500).json({
        success: false,
        error: `Failed to prepare remove liquidity transaction: ${error.message}`,
      });
    }
  })
);

// POST Prepare Collect Fees Transaction
app.post(
  "/api/bluefin/prepare-collect-fees",
  asyncHandler(async (req, res) => {
    const { poolId, positionId } = req.body;

    if (!poolId || !positionId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: poolId and positionId are required",
      });
    }

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Preparing collect fees for position ${positionId}`);

      // Check if there are fees to collect if possible
      let fees = null;
      try {
        fees = await queryChain.getAccruedFeeAndRewards(positionId);
        console.log(`Fees checked for position ${positionId}`);
      } catch (feeError) {
        console.warn("Could not check fees:", feeError.message);
      }

      // Prepare the transaction payload
      const txPayload = {
        target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::collect_fee`,
        arguments: [poolId, positionId],
      };

      res.json({
        success: true,
        data: {
          txPayload,
          fees,
        },
      });
    } catch (error) {
      console.error("Error preparing collect fees transaction:", error);
      res.status(500).json({
        success: false,
        error: `Failed to prepare collect fees transaction: ${error.message}`,
      });
    }
  })
);

// POST Prepare Close Position Transaction
app.post(
  "/api/bluefin/prepare-close-position",
  asyncHandler(async (req, res) => {
    const { poolId, positionId } = req.body;

    if (!poolId || !positionId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required parameters: poolId and positionId are required",
      });
    }

    if (!queryChain) {
      return res.status(500).json({
        success: false,
        error: "Bluefin client not initialized",
      });
    }

    try {
      console.log(`Preparing close position ${positionId}`);

      // Prepare the transaction payload
      const txPayload = {
        target: `${BLUEFIN_CONFIG.CurrentPackage}::clmm::close_position`,
        arguments: [poolId, positionId],
      };

      res.json({
        success: true,
        data: {
          txPayload,
        },
      });
    } catch (error) {
      console.error("Error preparing close position transaction:", error);
      res.status(500).json({
        success: false,
        error: `Failed to prepare close position transaction: ${error.message}`,
      });
    }
  })
);

// 404 for anything else under /api
app.use("/api/*", (_req, res) =>
  res.status(404).json({ success: false, message: "Not found" })
);

// Global error handler - place at the end of your server.js
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : `${err.message || "Unknown error"}`,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend proxy listening on http://localhost:${PORT}`);
  console.log(`🌊 Bluefin API available at /api/bluefin`);
});

export default app;
