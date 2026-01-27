import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { fid } = request.query;

  if (!fid) {
    return response.status(400).json({ error: 'Missing FID' });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Neynar API Key not configured' });
  }

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

    if (!neynarRes.ok) {
      const error = await neynarRes.text();
      return response.status(neynarRes.status).json({ error });
    }

    const data = await neynarRes.json();
    const user = data.users[0];

    // Calculate reputation/archetype (Mock algorithm for now based on real data)
    const followers = user.follower_count || 0;
    const following = user.following_count || 0;
    const ratio = following > 0 ? followers / following : 0;
    
    let archetype = "Lurker";
    if (followers > 10000) archetype = "Whale";
    else if (ratio > 2) archetype = "Builder"; // High signal?
    else if (user.verifications && user.verifications.length > 0) archetype = "Citizen";
    else archetype = "Normie";

    return response.status(200).json({
      user,
      stats: {
        reputation: Math.floor(followers * 0.1 + (user.active_status === 'active' ? 100 : 0)),
        archetype,
        growth: "+5% (7d)", // Mock growth calculation as we need history for real one
      }
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
