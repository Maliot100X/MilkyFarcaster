import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const limit = parseInt(process.env.NEXT_PUBLIC_LEADERBOARD_TOP || '50');
    const { data: dbUsers, error } = await supabase
      .from('users')
      .select('fid, xp, data')
      .order('xp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!dbUsers || dbUsers.length === 0) {
      return response.status(200).json({ leaderboard: [] });
    }

    // Enrich with Neynar Data if available
    let enrichedUsers = [...dbUsers];
    const fids = dbUsers.map(u => u.fid).join(',');
    const apiKey = process.env.NEYNAR_API_KEY;

    if (apiKey && fids) {
      try {
        const neynarRes = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`,
          {
            headers: {
              accept: 'application/json',
              'api_key': apiKey,
            },
          }
        );

        if (neynarRes.ok) {
          const neynarData = await neynarRes.json();
          const neynarUsersMap = new Map(
            neynarData.users.map((u: any) => [u.fid, u])
          );

          enrichedUsers = dbUsers.map(u => {
            const nUser = neynarUsersMap.get(u.fid);
            return {
              ...u,
              username: nUser?.username || `Farcaster User ${u.fid}`,
              display_name: nUser?.display_name || `User ${u.fid}`,
              pfp_url: nUser?.pfp_url || "https://placehold.co/400",
              follower_count: nUser?.follower_count || 0
            };
          });
        }
      } catch (e) {
        console.warn('Neynar bulk fetch failed:', e);
        // Fallback: use existing data or defaults
        enrichedUsers = dbUsers.map(u => ({
             ...u,
             username: `User ${u.fid}`,
             display_name: `User ${u.fid}`,
             pfp_url: "https://placehold.co/400"
        }));
      }
    } else {
        // No API key, just return basic data
        enrichedUsers = dbUsers.map(u => ({
             ...u,
             username: `User ${u.fid}`,
             display_name: `User ${u.fid}`,
             pfp_url: "https://placehold.co/400"
        }));
    }
    
    return response.status(200).json({ leaderboard: enrichedUsers });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    return response.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
