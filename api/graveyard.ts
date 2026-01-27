import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method === 'GET') {
    // Get recently deceased coins
    const { data, error } = await supabase
      .from('coins')
      .select('*')
      .eq('status', 'dead')
      .order('death_count', { ascending: false })
      .limit(10);

    if (error) {
      return response.status(500).json({ error: error.message });
    }
    return response.status(200).json({ graveyard: data });
  }

  if (request.method === 'POST') {
    // Declare a coin dead
    const { symbol, fid } = request.body;
    
    if (!symbol || !fid) {
      return response.status(400).json({ error: 'Missing symbol or FID' });
    }

    // Check if coin exists
    const { data: coin } = await supabase
      .from('coins')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (coin) {
      // Increment death count
      const { error } = await supabase
        .from('coins')
        .update({ 
          death_count: (coin.death_count || 0) + 1,
          status: 'dead',
          last_declared_by: fid
        })
        .eq('symbol', symbol.toUpperCase());
        
      if (error) return response.status(500).json({ error: error.message });
    } else {
      // Create new coin entry
      const { error } = await supabase
        .from('coins')
        .insert({
          symbol: symbol.toUpperCase(),
          death_count: 1,
          status: 'dead',
          last_declared_by: fid
        });
        
      if (error) return response.status(500).json({ error: error.message });
    }

    return response.status(200).json({ success: true, message: `${symbol} is dead.` });
  }

  return response.status(405).json({ error: 'Method Not Allowed' });
}
