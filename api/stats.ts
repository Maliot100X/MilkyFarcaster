import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { fid } = request.query;

  if (!fid) {
    return response.status(400).json({ error: 'Missing FID' });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  // We can proceed without Neynar key if needed, just returning Supabase data, 
  // but better to fail gracefully if Neynar is down/missing.

  try {
    // 1. Fetch Supabase Data (XP, Burns, Activity)
    const { data: userData } = await supabase
      .from('users')
      .select('xp, data')
      .eq('fid', fid)
      .single();

    const { data: burns } = await supabase
      .from('burns')
      .select('amount, created_at, token, xp_awarded')
      .eq('fid', fid)
      .order('created_at', { ascending: false });

    // Calculate internal stats
    const xp = userData?.xp || 0;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1; // Simple quadratic leveling
    const burnCount = burns?.length || 0;
    
    // Real Stats from DB
    const stats = userData?.data?.stats || {};
    const totalBurnedUsd = (stats.burned_usd || 0).toFixed(2);
    const totalSwappedUsd = (stats.swapped_usd || 0).toFixed(2);

    // Calculate Rank
    const { count: rankCount, error: rankError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('xp', xp);
    
    const rank = (rankCount || 0) + 1;

    // Recent activity merging
    // We would fetch game plays too if we had a separate table, but currently game plays are just updating XP.
    // We can use 'burns' as the main activity log for now.
    const recentActivity = burns?.slice(0, 5).map(b => ({
      id: b.created_at, // use timestamp as ID
      type: 'burn',
      description: `Burned ${parseFloat(b.amount) > 0 ? 'Tokens' : 'Trash'}`,
      amount: b.amount,
      timestamp: new Date(b.created_at).toLocaleDateString(),
      reward: 150 // fixed reward from burn api
    })) || [];

    let neynarUser = null;
    let neynarStats = null;

    if (apiKey) {
        try {
            const neynarRes = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
            {
                headers: {
                accept: 'application/json',
                'api_key': apiKey,
                },
            }
            );

            if (neynarRes.ok) {
                const data = await neynarRes.json();
                if (data.users && data.users.length > 0) {
                    neynarUser = data.users[0];
                    const followers = neynarUser.follower_count || 0;
                    const following = neynarUser.following_count || 0;
                    const ratio = following > 0 ? followers / following : 0;
                    
                    let archetype = "Lurker";
                    if (followers > 10000) archetype = "Whale";
                    else if (ratio > 2) archetype = "Builder";
                    else if (neynarUser.verifications && neynarUser.verifications.length > 0) archetype = "Citizen";
                    else archetype = "Normie";

                    neynarStats = {
                        reputation: Math.floor(followers * 0.1 + (neynarUser.active_status === 'active' ? 100 : 0)),
                        archetype,
                        growth: "+5% (7d)", 
                    };
                }
            }
        } catch (e) {
            console.warn("Neynar fetch failed", e);
        }
    }

    return response.status(200).json({
      user: neynarUser, // Can be null if Neynar fails
      stats: neynarStats, // Can be null
      gameData: {
          xp,
          level,
          rank,
          title: neynarStats?.archetype || "Novice", // Fallback title
          totalBurnedUsd,
          totalSwappedUsd,
          burnCount,
          subscription: {
              status: userData?.data?.subscription_status || 'free',
              end: userData?.data?.subscription_end || null,
              plan: userData?.data?.subscription_plan || null
          }
      },
      recentActivity
      }
    });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
