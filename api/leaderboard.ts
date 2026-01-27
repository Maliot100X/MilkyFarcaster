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
    const limit = parseInt(process.env.NEXT_PUBLIC_LEADERBOARD_TOP || '10');
    const { data, error } = await supabase
      .from('users')
      .select('fid, xp, data')
      .order('xp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // We might want to enrich this with usernames if we had them stored, 
    // but for now we'll return FIDs and let the frontend handle it 
    // (or we could fetch usernames from Neynar if we had that set up here, 
    // but the frontend FarcasterContext might be better suited or just show FID).
    // Actually, storing username in 'users' table would be good. 
    // But my current schema in 'burn.ts' and 'play.ts' only upserts 'fid', 'xp', 'last_active'.
    // I should check if I can store username too.
    
    return response.status(200).json({ leaderboard: data });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    return response.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
