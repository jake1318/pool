// src/services/coinGeckoService.ts

export interface PoolInfo {
  address: string;
  name: string;
  fee?: number | string;
  dex: string;
  liquidityUSD: number;
  volumeUSD: number;
  feesUSD: number;
  apr: number;
  rewardSymbols: string[];
}

const BASE_URL = "https://pro-api.coingecko.com/api/v3/onchain";
const API_KEY = import.meta.env.VITE_COINGECKO_API_KEY;

const withApiKey = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}x_cg_pro_api_key=${API_KEY}`;
};

function parseFee(feeRaw: any): number {
  if (typeof feeRaw === "string") {
    // e.g. "0.25%"
    const num = parseFloat(feeRaw.replace("%", ""));
    return isNaN(num) ? 0 : num / 100;
  } else if (typeof feeRaw === "number") {
    // if already fraction (e.g. 0.0025) assume it's correct
    return feeRaw > 1 ? feeRaw / 100 : feeRaw;
  }
  return 0;
}

/** normalize an individual API item into our PoolInfo */
function normalize(item: any): PoolInfo {
  const p = item.attributes ?? item;
  const rel = item.relationships ?? {};

  // pool name from API includes the fee (eg "LOFI / SUI 0.25%")
  const name = p.name || p.pool_name || "Unknown Pool";

  // fee tier (string or number)
  const rawFee =
    p.fee_tier ??
    p.fee ??
    p.fee_rate ??
    name.match(/(\d+(\.\d+)?%?)$/)?.[0] ??
    0;
  const feePct = parseFee(rawFee);

  // liquidity
  const liquidityUSD = Number(
    p.reserve_in_usd ?? p.reserve_usd ?? p.total_liquidity_usd ?? 0
  );

  // volume (24h) — API now returns an object volume_usd.h24
  const volumeRaw =
    p.volume_usd?.h24 ?? p.h24_volume_usd ?? p.volume_24h_usd ?? 0;
  const volumeUSD = Number(volumeRaw) || 0;

  // fees ~ volume * fee tier
  const feesUSD = volumeUSD * feePct;

  // APR or APY (if present)
  const aprValue = Number(p.apr ?? p.apy ?? 0);

  // rewards
  let rewards: string[] = [];
  if (p.rewarder_symbols) {
    rewards = Array.isArray(p.rewarder_symbols)
      ? p.rewarder_symbols
      : [p.rewarder_symbols];
  } else if (p.reward_tokens || p.rewarder_tokens) {
    const field = p.reward_tokens || p.rewarder_tokens;
    rewards = Array.isArray(field) ? field.map((r: any) => r.symbol || r) : [];
  }

  // dex hosting this pool
  const dex = rel.dex?.data?.id ?? "";

  return {
    address: p.pool_id ?? p.address ?? p.id ?? "",
    name,
    fee: rawFee,
    dex,
    liquidityUSD,
    volumeUSD,
    feesUSD,
    apr: aprValue,
    rewardSymbols: rewards,
  };
}

/** Fetch default Sui pools from CoinGecko Megafilter API */
export async function getDefaultPools(): Promise<PoolInfo[]> {
  const url = withApiKey(
    `${BASE_URL}/pools/megafilter?page=1&networks=sui-network&sort=h24_volume_usd_desc&checks=on_coingecko`
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }
  const json = await res.json();
  const list = json.data ?? [];
  return list.map(normalize);
}

/** Search pools by query (name, symbol, address) using CoinGecko API */
export async function searchPools(query: string): Promise<PoolInfo[]> {
  const url = withApiKey(
    `${BASE_URL}/search/pools?query=${encodeURIComponent(
      query
    )}&network=sui-network`
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko search error: ${res.status}`);
  }
  const json = await res.json();
  const hits = (json.data ?? []).filter((item: any) => {
    const net = item.network || item.network_id;
    return net === "sui-network" || net === "sui" || net === "sui_network";
  });
  const addresses = hits
    .map((item: any) => item.pool_id ?? item.address ?? item.id)
    .filter(Boolean);
  return await getPoolsByAddresses(addresses);
}

/** Fetch details for multiple pools by their addresses (on Sui network) */
export async function getPoolsByAddresses(
  addresses: string[]
): Promise<PoolInfo[]> {
  if (addresses.length === 0) return [];
  const addrParam = addresses.join(",");
  const url = withApiKey(
    `${BASE_URL}/networks/sui-network/pools/multi/${addrParam}`
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko multi-pool error: ${res.status}`);
  }
  const json = await res.json();
  const list = json.data ?? [];
  return list.map(normalize);
}
