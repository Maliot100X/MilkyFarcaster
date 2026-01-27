import type { VercelRequest, VercelResponse } from '@vercel/node';

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
      console.log(`Trying MoltBot provider: ${provider.name}`);
      
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
                       You can help with tasks, automation, and complex queries. Be concise and helpful.` 
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
