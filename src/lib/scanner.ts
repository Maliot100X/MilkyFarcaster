import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http()
});

const ERC20_MINIMAL_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export type TokenBalance = {
  name: string;
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  balance: string; // formatted
  rawBalance: bigint;
  usdValue?: number;
  logo?: string;
};

export async function fetchTokenBalances(address: string): Promise<TokenBalance[]> {
  if (!address) return [];

  try {
    // 1. Discovery: Get Token List from Blockscout (Indexer)
    const res = await fetch(`https://base.blockscout.com/api?module=account&action=tokenlist&address=${address}`);
    const data = await res.json();

    if (data.status === "1" && Array.isArray(data.result)) {
      // Filter potential ERC20s
      const potentialTokens = data.result
        .filter((t: any) => t.type === "ERC-20" && t.contractAddress);

      if (potentialTokens.length === 0) return [];

      // 2. Verification: Onchain Multicall for Exact Balances
      // We do this to ensure we are not displaying stale data from the indexer
      const contracts = potentialTokens.map((t: any) => ({
        address: t.contractAddress as `0x${string}`,
        abi: ERC20_MINIMAL_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`]
      }));

      // Chunk multicall to avoid RPC limits (e.g., 50 at a time)
      const chunkSize = 50;
      const results = [];
      
      for (let i = 0; i < contracts.length; i += chunkSize) {
          const chunk = contracts.slice(i, i + chunkSize);
          const chunkResults = await client.multicall({ contracts: chunk, allowFailure: true });
          results.push(...chunkResults);
      }

      // 3. Construct TokenBalance Objects
      const verifiedTokens: TokenBalance[] = [];
      
      for (let i = 0; i < potentialTokens.length; i++) {
          const t = potentialTokens[i];
          const result = results[i];

          if (result.status === "success" && (result.result as bigint) > 0n) {
             const rawBalance = result.result as bigint;
             const decimals = parseInt(t.decimals || "18");
             
             verifiedTokens.push({
                 name: t.name,
                 symbol: t.symbol,
                 address: t.contractAddress as `0x${string}`,
                 decimals: decimals,
                 rawBalance: rawBalance,
                 balance: formatUnits(rawBalance, decimals),
                 logo: t.logoUrl || undefined
             });
          }
      }
      
      // 4. Fetch Prices (DefiLlama)
      try {
        const addresses = verifiedTokens.map(t => t.address);
        const prices = await fetchTokenPrices(addresses);
        verifiedTokens.forEach(t => {
          if (prices[t.address.toLowerCase()]) {
            t.usdValue = prices[t.address.toLowerCase()];
          }
        });
      } catch (e) {
        console.warn("Failed to fetch prices, continuing without them", e);
      }

      return verifiedTokens;
    }
  } catch (e) {
    console.error("Scanner failed:", e);
  }
  return [];
}

export async function fetchTokenMetadata(address: string, userAddress: string): Promise<TokenBalance | null> {
  try {
    // 1. Get Metadata (Onchain)
    const client = createPublicClient({
      chain: base,
      transport: http()
    });

    const erc20Abi = parseAbi([
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)'
    ]);

    const [name, symbol, decimals, balance] = await client.multicall({
      contracts: [
        { address: address as `0x${string}`, abi: erc20Abi, functionName: 'name' },
        { address: address as `0x${string}`, abi: erc20Abi, functionName: 'symbol' },
        { address: address as `0x${string}`, abi: erc20Abi, functionName: 'decimals' },
        { address: address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }
      ],
      allowFailure: false
    });

    const token: TokenBalance = {
      name: name as string,
      symbol: symbol as string,
      address: address as `0x${string}`,
      decimals: decimals as number,
      rawBalance: balance as bigint,
      balance: formatUnits(balance as bigint, decimals as number),
    };

    // 2. Get Price
    const prices = await fetchTokenPrices([address]);
    if (prices[address.toLowerCase()]) {
      token.usdValue = prices[address.toLowerCase()];
    }

    return token;
  } catch (e) {
    console.error("Failed to fetch token metadata:", e);
    return null;
  }
}

export async function fetchTokenPrices(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  
  try {
    // DefiLlama limits: unclear, but chunking is safe. URL length limit is main concern.
    const chunks = [];
    const chunkSize = 30;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      chunks.push(addresses.slice(i, i + chunkSize));
    }

    const prices: Record<string, number> = {};

    for (const chunk of chunks) {
      // Format: base:0x...,base:0x...
      const query = chunk.map(a => `base:${a}`).join(',');
      const res = await fetch(`https://coins.llama.fi/prices/current/${query}`);
      const data = await res.json();
      
      // Response: { "coins": { "base:0x...": { "price": 1.23, ... } } }
      if (data.coins) {
          Object.keys(data.coins).forEach(key => {
              const address = key.split(':')[1].toLowerCase();
              prices[address] = data.coins[key].price;
          });
      }
    }

    return prices;
  } catch (e) {
    console.error("Price fetch failed:", e);
    return {};
  }
}
