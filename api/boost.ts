import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { supabase } from './_lib/supabase';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL)
});

const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET || "0x0000000000000000000000000000000000000000";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const apiKey = process.env.NEYNAR_API_KEY;

  // GET: Fetch active boosts
  if (request.method === 'GET') {
      const { data, error } = await supabase
          .from('boosts')
          .select('*')
          .gt('boosted_until', Date.now())
          .order('boosted_until', { ascending: true });
      
      if (error) return response.status(500).json({ error: error.message });
      return response.status(200).json(data);
  }

  // POST: Actions
  if (request.method === 'POST') {
      const { action } = request.body;

      // 1. Preview Cast
      if (action === 'preview') {
          const { url } = request.body;
          if (!url || !apiKey) return response.status(400).json({ error: 'Missing URL or API Key' });

          try {
              let targetUrl = url;
              // Check if input is a username (starts with @ or no slashes)
              if (!url.includes('http') && !url.includes('warpcast.com')) {
                  const username = url.replace('@', '');
                  // Fetch user first
                  const userRes = await fetch(
                      `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
                      { headers: { accept: 'application/json', 'api_key': apiKey } }
                  );
                  
                  if (!userRes.ok) return response.status(404).json({ error: 'User not found' });
                  const userData = await userRes.json();
                  const fid = userData.user.fid;

                  // Fetch latest cast
                  const castRes = await fetch(
                      `https://api.neynar.com/v2/farcaster/feed/user/${fid}?limit=1`,
                      { headers: { accept: 'application/json', 'api_key': apiKey } }
                  );
                  const castData = await castRes.json();
                  if (!castData.casts || castData.casts.length === 0) return response.status(404).json({ error: 'No casts found for user' });
                  
                  return response.status(200).json(castData.casts[0]);
              }

              // URL Search
              const neynarRes = await fetch(
                  `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(url)}&type=url`,
                  {
                      headers: {
                          accept: 'application/json',
                          'api_key': apiKey,
                      },
                  }
              );
              
              if (!neynarRes.ok) return response.status(400).json({ error: 'Invalid URL or Cast not found' });
              
              const data = await neynarRes.json();
              return response.status(200).json(data.cast);
          } catch (e) {
              return response.status(500).json({ error: 'Neynar API Error' });
          }
      }

      // 2. Boost Cast (Verify Payment + Store)
      if (action === 'boost' || action === 'burn_boost') {
          const { txHash, cast, coin, duration, fid, tokenValueUsd } = request.body;
          if (!txHash || (!cast && !coin) || !fid) {
              return response.status(400).json({ error: 'Missing required fields' });
          }

          try {
              let durationMs = 0;
              let boostType = 'paid';

              if (action === 'burn_boost') {
                  boostType = 'burn';
                  // Calculate duration based on tokenValueUsd
                  // Rule: $1 = 10 mins. 
                  const value = parseFloat(tokenValueUsd || "0");
                  const minutes = Math.floor(value * 10); // $0.10 = 1 min
                  durationMs = Math.max(minutes, 1) * 60 * 1000; // Minimum 1 minute
              } else {
                  // Paid/Free Boost
                  durationMs = duration === '10m' ? 10 * 60 * 1000 : 30 * 60 * 1000;
              }

              // Handle Subscriber Free Boost
              if (txHash === 'FREE_BOOST') {
                  // 1. Verify Subscription
                  const { data: user, error: userError } = await supabase
                      .from('users')
                      .select('data')
                      .eq('fid', fid)
                      .single();
                  
                  if (userError || !user?.data?.subscription_status || user.data.subscription_status !== 'active') {
                       return response.status(403).json({ error: 'Not a subscriber' });
                  }
                  
                  if (new Date(user.data.subscription_end) < new Date()) {
                       return response.status(403).json({ error: 'Subscription expired' });
                  }

                  // 2. Check 24h Limit
                  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                  const { count, error: countError } = await supabase
                      .from('boosts')
                      .select('*', { count: 'exact', head: true })
                      .eq('fid', fid)
                      .eq('tx_hash', 'FREE_BOOST')
                      .gt('created_at', oneDayAgo);

                  if (countError || (count && count > 0)) {
                      return response.status(403).json({ error: 'Daily free boost already used' });
                  }

                  // Force 10m duration for free boost
                  durationMs = 10 * 60 * 1000; 
              } else {
                  // Verify Transaction
                  const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
                  if (receipt.status === 'reverted') return response.status(400).json({ error: 'Transaction reverted' });

                  // Strict Check for Paid Boosts
                  if (boostType === 'paid') {
                      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
                      const expectedValue = duration === '10m' ? parseEther('0.0003') : parseEther('0.001');
                      
                      // Allow small margin of error or exact match? Exact match is safer for strict logic.
                      // Using >= to allow generous users (or rounding issues if any, though BigInt is precise)
                      if (tx.value < expectedValue) return response.status(400).json({ error: 'Insufficient payment value' });
                      
                      if (!tx.to || tx.to.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
                          return response.status(400).json({ error: 'Invalid payment recipient' });
                      }
                  }
              }
              
              // Calculate boost time
              const boostedUntil = Date.now() + durationMs;

              // Store in Supabase
              // If coin is present, store as coin boost
              let insertData: any = {
                  fid,
                  boosted_until: boostedUntil,
                  tx_hash: txHash,
                  created_at: new Date().toISOString()
              };

              if (coin) {
                  insertData = {
                      ...insertData,
                      cast_url: `coin:${coin.symbol}`,
                      author_data: {
                          username: coin.symbol,
                          display_name: coin.name,
                          pfp_url: coin.image
                      },
                      text: `Boosted ${coin.name} ($${coin.symbol})!`,
                      image: coin.image
                  };
              } else {
                  insertData = {
                      ...insertData,
                      cast_url: cast.hash || cast.url,
                      author_data: cast.author,
                      text: cast.text,
                      image: cast.embeds?.[0]?.url || null,
                  };
              }

              const { error } = await supabase.from('boosts').insert(insertData);

              if (error) return response.status(500).json({ error: error.message });

              return response.status(200).json({ success: true, boostedUntil });

          } catch (e) {
              console.error(e);
              return response.status(500).json({ error: 'Verification failed' });
          }
      }

      return response.status(400).json({ error: 'Invalid action' });
  }

  return response.status(405).json({ error: 'Method Not Allowed' });
}
