import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

interface Provider {
  name: string;
  url: string;
  key?: string;
  model: string;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages, userContext } = request.body;
  const lastMessage = messages[messages.length - 1]?.content || "";
  const fid = userContext?.fid;

  // --- COMMAND HANDLING ---
  if (lastMessage.startsWith('/')) {
    const parts = lastMessage.trim().split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // /stats
    if (command === '/stats') {
        if (!fid) return response.json({ content: "I need to know who you are first! Please connect your wallet/Farcaster." });

        try {
            const { data: userData } = await supabase.from('users').select('xp, data').eq('fid', fid).single();
            const { count: burnCount } = await supabase.from('burns').select('*', { count: 'exact', head: true }).eq('fid', fid);
            
            const xp = userData?.xp || 0;
            const level = Math.floor(Math.sqrt(xp / 100)) + 1;
            const stats = userData?.data?.stats || {};
            const burned = stats.burned_usd || 0;
            const boosts = stats.boosts_applied || 0;

            // Rank
            const { count: rankCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).gt('xp', xp);
            const rank = (rankCount || 0) + 1;

            return response.json({ 
                content: `📊 **Your Stats**\n\n` +
                         `🛡️ **Level:** ${level}\n` +
                         `✨ **XP:** ${xp}\n` +
                         `🏆 **Rank:** #${rank}\n` +
                         `🔥 **Burned:** $${burned.toFixed(2)}\n` +
                         `🚀 **Boosts:** ${boosts}\n` +
                         `💀 **Burn Txns:** ${burnCount || 0}`
            });
        } catch (e) {
            console.error(e);
            return response.json({ content: "Failed to fetch stats. Try again later." });
        }
    }

    // /cast [url/handle]
    if (command === '/cast') {
        const target = args[0];
        if (!target) return response.json({ content: "Please provide a Farcaster URL or username. Usage: `/cast https://...` or `/cast @dwr`" });

        const apiKey = process.env.NEYNAR_API_KEY;
        if (!apiKey) return response.json({ content: "System configuration error: Missing API Key." });

        try {
            let castData = null;
            let castUrl = target;

            // Handle URL
            if (target.startsWith('http')) {
                const res = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(target)}&type=url`, {
                    headers: { accept: 'application/json', api_key: apiKey }
                });
                const data = await res.json();
                castData = data.cast;
            } 
            // Handle Username (@handle or just handle)
            else {
                const username = target.replace('@', '');
                const uRes = await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`, {
                    headers: { accept: 'application/json', api_key: apiKey }
                });
                const uData = await uRes.json();
                if (uData.user) {
                     // Get latest cast
                     const fRes = await fetch(`https://api.neynar.com/v2/farcaster/feed/user/${uData.user.fid}?limit=1`, {
                        headers: { accept: 'application/json', api_key: apiKey }
                    });
                    const fData = await fRes.json();
                    castData = fData.casts?.[0];
                    if (castData) castUrl = `https://warpcast.com/${username}/${castData.hash.substring(0, 10)}`;
                }
            }

            if (!castData) {
                return response.json({ content: "❌ Cast not found. Please check the URL or username." });
            }

            return response.json({
                content: `🔍 **Cast Found!**\n\n` +
                         `👤 **Author:** ${castData.author.display_name} (@${castData.author.username})\n` +
                         `📝 **Text:** "${castData.text.substring(0, 100)}${castData.text.length > 100 ? '...' : ''}"\n` +
                         `❤️ ${castData.reactions.likes_count}  🔁 ${castData.reactions.recasts_count}\n\n` +
                         `Ready to boost this cast?`,
                actions: [
                    { 
                        label: "🔥 Pay & Boost", 
                        type: "navigate", 
                        payload: `/burn?boostCast=${encodeURIComponent(castUrl)}` 
                    },
                    {
                        label: "🔗 View on Warpcast",
                        type: "link",
                        payload: castUrl
                    }
                ]
            });

        } catch (e) {
            console.error(e);
            return response.json({ content: "Error fetching cast data." });
        }
    }

    // /burn [token] [amount]
    if (command === '/burn') {
        return response.json({
            content: "To burn tokens, go to the Burn page. You can select any ERC20 token to burn for XP and Boost power.",
            actions: [{ label: "Go to Burn", type: "navigate", payload: "/burn" }]
        });
    }

    // /boost
    if (command === '/boost') {
         return response.json({
            content: "You can boost casts or coins using your burned tokens! Check the Home feed to see what's trending.",
            actions: [{ label: "Go to Feed", type: "navigate", payload: "/home" }]
        });
    }
  }

  // --- LLM FALLBACK ---

  // Configure providers based on keys
  const providers: Provider[] = [
    {
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.MOLTBOT_API_KEY_1,
      model: 'llama3-70b-8192'
    },
    {
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.MOLTBOT_API_KEY_2,
      model: 'openai/gpt-4o-mini' // or auto
    },
    {
      name: 'GitHub Models',
      url: 'https://models.inference.ai.azure.com/chat/completions',
      key: process.env.MOLTBOT_API_KEY_3,
      model: 'gpt-4o'
    }
  ].filter(p => !!p.key);

  if (providers.length === 0) {
    return response.status(503).json({ 
      content: "MoltBot is currently offline (No active keys)." 
    });
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      // console.log(`Trying MoltBot provider: ${provider.name}`);
      
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`,
          ...(provider.name === 'OpenRouter' ? {
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://milky-farcaster.vercel.app/',
            'X-Title': 'MilkyFarcaster'
          } : {})
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { 
              role: "system", 
              content: `You are MoltBot, an advanced AI agent embedded in MilkyFarcaster. 
                       User Context: FID ${userContext?.fid || 'Unknown'}, Username ${userContext?.username || 'Unknown'}.
                       You can help with tasks, automation, and complex queries. 
                       Available commands: /stats, /cast [url], /burn, /boost.
                       Be concise and helpful.` 
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`${provider.name} failed: ${errorText}`);
        lastError = errorText;
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.output || "I'm thinking, but got no words.";
      
      return response.status(200).json({ content });

    } catch (error) {
      console.error(`${provider.name} Error:`, error);
      lastError = error;
    }
  }

  return response.status(500).json({ 
    content: "MoltBot is having trouble connecting to its brain centers right now. Please try again.",
    debug: lastError
  });
}
