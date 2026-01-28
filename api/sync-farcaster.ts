import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { fid } = request.body;
  const apiKey = process.env.NEYNAR_API_KEY;

  if (!fid) {
    return response.status(400).json({ error: 'Missing FID' });
  }

  try {
    // 1. Fetch User Data from Neynar
    let neynarUser = null;
    if (apiKey) {
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
        }
      }
    }

    if (!neynarUser) {
      return response.status(404).json({ error: 'User not found on Farcaster' });
    }

    // 2. Prepare Data for Supabase
    // We store the custody address and verified addresses to check wallet connection on frontend
    const userData = {
      fid: neynarUser.fid,
      username: neynarUser.username,
      display_name: neynarUser.display_name,
      pfp_url: neynarUser.pfp_url,
      custody_address: neynarUser.custody_address,
      verified_addresses: neynarUser.verifications || [],
      updated_at: new Date().toISOString()
    };

    // 3. Upsert into Supabase
    const { error } = await supabase
      .from('users')
      .upsert({
        fid: fid,
        data: {
            ...userData,
            // Preserve existing stats if any, or initialize
            stats: undefined 
        } 
      }, { onConflict: 'fid' });
      
    // Note: The above upsert might overwrite 'data' field completely if we are not careful.
    // Ideally we merge. But Supabase upsert replaces. 
    // Let's do a check first or use a jsonb_set in SQL, but for now let's just fetch existing first.
    
    const { data: existingUser } = await supabase.from('users').select('data').eq('fid', fid).single();
    const existingStats = existingUser?.data?.stats || {};
    
    const finalData = {
        ...userData,
        stats: existingStats
    };

    const { error: upsertError } = await supabase
        .from('users')
        .upsert({
            fid: fid,
            username: neynarUser.username, // Top level columns if they exist
            data: finalData
        });

    if (upsertError) {
        console.error("Supabase error:", upsertError);
        return response.status(500).json({ error: 'Failed to sync user data' });
    }

    return response.status(200).json(finalData);

  } catch (e) {
    console.error("Sync failed:", e);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}