// backend/routes/bluefinRoutes.js
const express = require("express");
const router = express.Router();
const bluefinService = require("../services/bluefinService");

// Middleware to handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// GET pool information
router.get(
  "/pools/:poolId",
  asyncHandler(async (req, res) => {
    const { poolId } = req.params;
    const pool = await bluefinService.getPool(poolId);
    res.json(pool);
  })
);

// GET all pools (paginated)
router.get(
  "/pools",
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const pools = await bluefinService.getPools(limit, offset);
    res.json(pools);
  })
);

// GET user positions
router.get(
  "/positions/:address",
  asyncHandler(async (req, res) => {
    const { address } = req.params;
    const positions = await bluefinService.getUserPositions(address);
    res.json(positions);
  })
);

// GET position details
router.get(
  "/position/:positionId",
  asyncHandler(async (req, res) => {
    const { positionId } = req.params;
    const position = await bluefinService.getPositionDetails(positionId);
    res.json(position);
  })
);

// POST prepare add liquidity transaction
router.post(
  "/prepare-add-liquidity",
  asyncHandler(async (req, res) => {
    const { poolId, amountA, amountB, decimalsA, decimalsB } = req.body;

    // Validate input parameters
    if (!poolId || amountA === undefined || amountB === undefined) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Use provided decimals or guess from token symbols
    const actualDecimalsA = decimalsA || 9;
    const actualDecimalsB = decimalsB || 9;

    const txData = await bluefinService.prepareAddLiquidity(
      poolId,
      parseFloat(amountA),
      parseFloat(amountB),
      actualDecimalsA,
      actualDecimalsB
    );

    res.json(txData);
  })
);

// POST prepare remove liquidity transaction
router.post(
  "/prepare-remove-liquidity",
  asyncHandler(async (req, res) => {
    const { poolId, positionId, liquidityPercent } = req.body;

    // Validate input parameters
    if (!poolId || !positionId || liquidityPercent === undefined) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const txData = await bluefinService.prepareRemoveLiquidity(
      poolId,
      positionId,
      parseInt(liquidityPercent)
    );

    res.json(txData);
  })
);

// POST prepare collect fees transaction
router.post(
  "/prepare-collect-fees",
  asyncHandler(async (req, res) => {
    const { poolId, positionId } = req.body;

    // Validate input parameters
    if (!poolId || !positionId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const txData = await bluefinService.prepareCollectFees(poolId, positionId);
    res.json(txData);
  })
);

// POST prepare close position transaction
router.post(
  "/prepare-close-position",
  asyncHandler(async (req, res) => {
    const { poolId, positionId } = req.body;

    // Validate input parameters
    if (!poolId || !positionId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const txData = await bluefinService.prepareClosePosition(
      poolId,
      positionId
    );
    res.json(txData);
  })
);

// Error handler middleware
router.use((err, req, res, next) => {
  console.error("Bluefin API Error:", err);
  res.status(500).json({ error: err.message });
});

module.exports = router;
