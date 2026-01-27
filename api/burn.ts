import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem';
import { base } from 'viem/chains';
import { supabase } from './_lib/supabase';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL)
});

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";
const TRANSFER_EVENT_ABI = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { txHash, fid, tokenAddress } = request.body;

  if (!txHash || !fid) {
    return response.status(400).json({ error: 'Missing txHash or fid' });
  }

  try {
    // 1. Check idempotency via Supabase
    const { data: existingTx } = await supabase
      .from('burns')
      .select('tx_hash')
      .eq('tx_hash', txHash)
      .single();

    if (existingTx) {
      return response.status(400).json({ error: 'Transaction already processed' });
    }

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt.status === 'reverted') {
      return response.status(400).json({ error: 'Transaction reverted' });
    }

    let isValidBurn = false;
    let burnAmount = BigInt(0);
    let burnedToken = "ETH";

    // ... (Verification logic remains similar)
    if (receipt.to?.toLowerCase() === DEAD_ADDRESS) {
      isValidBurn = true;
    } else {
      for (const log of receipt.logs) {
        try {
          if (tokenAddress && log.address.toLowerCase() !== tokenAddress.toLowerCase()) {
             continue;
          }
          const decoded = decodeEventLog({
            abi: [TRANSFER_EVENT_ABI],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'Transfer' && decoded.args.to?.toLowerCase() === DEAD_ADDRESS) {
            isValidBurn = true;
            burnAmount = decoded.args.value || BigInt(0);
            burnedToken = log.address;
            break; 
          }
        } catch (e) { continue; }
      }
    }

    if (isValidBurn) {
       const award = 150; 

       // 2. Record Burn in Supabase
       await supabase.from('burns').insert({
          tx_hash: txHash,
          fid: fid,
          token: burnedToken,
          amount: burnAmount.toString(),
          xp_awarded: award,
          created_at: new Date().toISOString()
       });

       // 3. Update User XP in Supabase
       const { data: user } = await supabase.from('users').select('xp').eq('fid', fid).single();
       const currentXp = user?.xp || 0;
       const newXp = currentXp + award;

       await supabase.from('users').upsert({
           fid: fid,
           xp: newXp,
           last_active: new Date().toISOString()
       });
       
       return response.status(200).json({ 
         success: true, 
         xpAwarded: award, 
         newTotalXp: newXp,
         token: burnedToken
       });
    } else {
        return response.status(400).json({ error: 'No valid burn detected' });
    }

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Verification failed' });
  }
}
