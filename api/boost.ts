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
              const neynarRes = await fetch(
                  `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(url)}&type=url`,
                  {
                      headers: {
                          accept: 'application/json',
                          'api_key': apiKey,
                      },
                  }
              );
              
              if (!neynarRes.ok) return response.status(400).json({ error: 'Failed to fetch cast' });
              
              const data = await neynarRes.json();
              return response.status(200).json(data.cast);
          } catch (e) {
              return response.status(500).json({ error: 'Neynar API Error' });
          }
      }

      // 2. Boost Cast (Verify Payment + Store)
      if (action === 'boost') {
          const { txHash, cast, duration, fid } = request.body;
          if (!txHash || !cast || !duration || !fid) {
              return response.status(400).json({ error: 'Missing required fields' });
          }

          try {
              let durationMs = duration === '10m' ? 10 * 60 * 1000 : 30 * 60 * 1000;

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
              }
              
              // Calculate boost time
              const boostedUntil = Date.now() + durationMs;

              // Store in Supabase
              const { error } = await supabase.from('boosts').insert({
                  fid,
                  cast_url: cast.hash || cast.url, // store hash or url
                  author_data: cast.author,
                  text: cast.text,
                  image: cast.embeds?.[0]?.url || null,
                  boosted_until: boostedUntil,
                  tx_hash: txHash,
                  created_at: new Date().toISOString()
              });

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
