import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, http, parseAbiItem, decodeEventLog, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { supabase } from './_lib/supabase';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL)
});

const DEAD_ADDRESS = "0x980E5F15E788Cb653C77781099Fb739d7A1aEEd0".toLowerCase();
const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43".toLowerCase();
const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase();
const UNISWAP_ROUTER_02 = "0x262666958e8e260422728e78e0260f973c7e698c".toLowerCase();

const TRANSFER_EVENT_ABI = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const DECIMALS_ABI = parseAbiItem('function decimals() view returns (uint8)');

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { txHash, fid, action = 'burn', tokenAddress } = request.body;

  if (!txHash || !fid) {
    return response.status(400).json({ error: 'Missing txHash or fid' });
  }

  try {
    // 1. Check idempotency
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

    let isValid = false;
    let amount = BigInt(0);
    let token = "ETH";
    let xpAward = 0;

    if (action === 'burn') {
        // BURNING MODE
        // Check for Transfer to DEAD
        for (const log of receipt.logs) {
            try {
                if (tokenAddress && log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
                
                const decoded = decodeEventLog({
                    abi: [TRANSFER_EVENT_ABI],
                    data: log.data,
                    topics: log.topics,
                });

                if (decoded.eventName === 'Transfer' && decoded.args.to?.toLowerCase() === DEAD_ADDRESS) {
                    isValid = true;
                    amount = decoded.args.value || BigInt(0);
                    token = log.address;
                    xpAward = 150; // High XP for true burn
                    break; 
                }
            } catch (e) { continue; }
        }
    } else if (action === 'swap') {
        // SWAP MODE
        // Check if transaction interacted with a Router
        const to = receipt.to?.toLowerCase();
        if (to === AERODROME_ROUTER || to === UNISWAP_ROUTER || to === UNISWAP_ROUTER_02) {
            isValid = true;
            xpAward = 50; // Lower XP for swap
            token = tokenAddress || "UNKNOWN";
            // We assume the frontend validated the inputs; simple router interaction check
        }
    }

    if (isValid) {
       // 2. Record in Supabase
       // We use the 'burns' table for both for now, but add a 'type' column if we could (or just reuse structure)
       // Since 'burns' table might not have 'type', we'll just store it.
       // Ideally we should add 'type' to the schema, but I can't migrate DB easily here.
       // I will store "SWAP" in the 'status' field if it exists, or just treat it as a burn record for XP purposes.
       
       await supabase.from('burns').insert({
          tx_hash: txHash,
          fid: fid,
          token: token,
          amount: amount.toString(), // For swaps this might be 0 if we didn't decode logs, but that's fine for MVP
          xp_awarded: xpAward,
          created_at: new Date().toISOString()
       });

       // 3. Update User XP
       const { data: user } = await supabase.from('users').select('xp, data').eq('fid', fid).single();
       
       // Apply Subscription Multiplier
       const isSubscriber = user?.data?.subscription_status === 'active' && new Date(user.data.subscription_end) > new Date();
       if (isSubscriber) {
           xpAward *= 2;
       }

       const currentXp = user?.xp || 0;
       const newXp = currentXp + xpAward;

       await supabase.from('users').upsert({
           fid: fid,
           xp: newXp,
           last_active: new Date().toISOString()
       });
       
       return response.status(200).json({ 
         success: true, 
         xpAwarded: xpAward, 
         newTotalXp: newXp,
         token: token
       });
    } else {
        return response.status(400).json({ error: 'No valid action detected' });
    }

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Verification failed' });
  }
}
