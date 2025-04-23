const BIRDEYE_API_KEY = "22430f5885a74d3b97e7cbd01c2140aa";
const BIRDEYE_BASE_URL = "https://public-api.birdeye.so/defi/v3";
const MAX_REQUESTS_PER_SECOND = 10; // Setting it lower than the limit (15) to be safe

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  extensions?: {
    twitter?: string;
    website?: string;
    telegram?: string;
  };
  logo_uri: string;
}

/**
 * Token metadata cache to avoid redundant API calls
 */
const tokenMetadataCache: Record<string, TokenMetadata> = {};

/**
 * Simple rate limiter
 */
class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private requestTimestamps: number[] = [];
  private maxRequestsPerSecond: number;

  constructor(maxRequestsPerSecond: number) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.waitForRateLimit();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running || this.queue.length === 0) return;

    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.running = false;
  }

  private async waitForRateLimit() {
    const now = Date.now();

    // Remove timestamps older than 1 second
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < 1000
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerSecond) {
      // Calculate how long we need to wait
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 1000 - (now - oldestTimestamp);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Add current timestamp to the list
    this.requestTimestamps.push(Date.now());
  }
}

// Create a rate limiter instance
const rateLimiter = new RateLimiter(MAX_REQUESTS_PER_SECOND);

/**
 * Get token metadata from Birdeye API with rate limiting
 */
export async function getTokenMetadata(
  tokenAddress: string
): Promise<TokenMetadata | null> {
  // Check cache first
  if (tokenMetadataCache[tokenAddress]) {
    return tokenMetadataCache[tokenAddress];
  }

  return rateLimiter.schedule(async () => {
    try {
      // Encode the token address properly for the URL
      const encodedAddress = encodeURIComponent(tokenAddress);

      const response = await fetch(
        `${BIRDEYE_BASE_URL}/token/meta-data/single?address=${encodedAddress}`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
            "x-chain": "sui",
            "X-API-KEY": BIRDEYE_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Birdeye API error: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        // Cache the result
        tokenMetadataCache[tokenAddress] = responseData.data;
        return responseData.data;
      }

      return null;
    } catch (error) {
      console.error(
        `Failed to fetch metadata for token ${tokenAddress}:`,
        error
      );
      return null;
    }
  });
}

/**
 * Get metadata for multiple tokens at once in batches
 */
export async function getMultipleTokenMetadata(
  tokenAddresses: string[]
): Promise<Record<string, TokenMetadata>> {
  const result: Record<string, TokenMetadata> = {};
  const batchSize = 5; // Process 5 tokens at a time to stay within rate limits

  // Filter out tokens we already have in cache
  const uncachedAddresses = tokenAddresses.filter(
    (addr) => !tokenMetadataCache[addr]
  );

  if (uncachedAddresses.length === 0) {
    // All tokens are already in cache
    tokenAddresses.forEach((addr) => {
      if (tokenMetadataCache[addr]) {
        result[addr] = tokenMetadataCache[addr];
      }
    });
    return result;
  }

  console.log(
    `Fetching metadata for ${uncachedAddresses.length} tokens in batches of ${batchSize}`
  );

  // Process in batches
  for (let i = 0; i < uncachedAddresses.length; i += batchSize) {
    const batch = uncachedAddresses.slice(i, i + batchSize);

    // Show progress
    console.log(
      `Processing batch ${i / batchSize + 1}/${Math.ceil(
        uncachedAddresses.length / batchSize
      )}`
    );

    // Process batch with Promise.all
    const batchResults = await Promise.all(
      batch.map(async (address) => {
        const metadata = await getTokenMetadata(address);
        if (metadata) {
          result[address] = metadata;
        }
        return { address, metadata };
      })
    );

    // Log success/failure counts
    const success = batchResults.filter((r) => r.metadata !== null).length;
    console.log(`Batch completed: ${success}/${batch.length} successful`);
  }

  // Add cached tokens to the result
  tokenAddresses.forEach((addr) => {
    if (tokenMetadataCache[addr] && !result[addr]) {
      result[addr] = tokenMetadataCache[addr];
    }
  });

  return result;
}
