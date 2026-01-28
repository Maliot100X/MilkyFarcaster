
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fid, txHash, plan } = request.body;

  if (!fid || !txHash || !plan) {
    return response.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1. Calculate new subscription end date
    const now = new Date();
    let endDate = new Date();

    if (plan === 'subscription') {
      endDate.setMonth(now.getMonth() + 1); // +1 Month
    } else if (plan === 'trial') {
      endDate.setDate(now.getDate() + 1); // +24 Hours
    } else {
      return response.status(400).json({ error: 'Invalid plan' });
    }

    // 2. Get current user data
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('data')
      .eq('fid', fid)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const currentData = userData?.data || {};
    
    // Check if already subscribed to extend? 
    // For simplicity, we just set new end date from now, or extend if current end date is in future.
    const currentEnd = currentData.subscription_end ? new Date(currentData.subscription_end) : null;
    
    if (currentEnd && currentEnd > now) {
      // Extend existing
      if (plan === 'subscription') {
        currentEnd.setMonth(currentEnd.getMonth() + 1);
        endDate = currentEnd;
      }
      // Trials don't stack usually, but let's just ignore trial if already pro
    }

    // 3. Update Supabase
    const { error: updateError } = await supabase
      .from('users')
      .upsert({
        fid,
        data: {
          ...currentData,
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_end: endDate.toISOString(),
          last_payment_hash: txHash
        },
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;

    return response.status(200).json({ 
      success: true, 
      subscription_end: endDate.toISOString(),
      plan 
    });

  } catch (error) {
    console.error('Shop Error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
