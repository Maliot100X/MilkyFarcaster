import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEYS = [
  process.env.AIML_API_KEY_1,
  process.env.AIML_API_KEY_2,
  process.env.AIML_API_KEY_3
].filter(Boolean) as string[];

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages } = request.body;

  if (KEYS.length === 0) {
    return response.status(503).json({ 
      content: "AI service is currently unavailable (Configuration Error)." 
    });
  }

  let lastError = null;

  for (const apiKey of KEYS) {
    try {
      const aiRes = await fetch('https://api.aimlapi.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // AIML supports various models, defaulting to a strong one
          messages: [
            { role: "system", content: "You are MilkyBot, a helpful assistant for MilkyFarcaster. You are knowledgeable about Farcaster, Base, and crypto." },
            ...messages
          ],
          max_tokens: 500
        })
      });

      if (!aiRes.ok) {
        const err = await aiRes.text();
        console.warn(`AIML API failed with key ending in ...${apiKey.slice(-4)}: ${err}`);
        lastError = err;
        continue; // Try next key
      }

      const data = await aiRes.json();
      if (data.choices && data.choices.length > 0) {
        return response.status(200).json({ content: data.choices[0].message.content });
      }
    } catch (error) {
      console.error('AI Request Error:', error);
      lastError = error;
    }
  }

  return response.status(500).json({ 
    error: 'All AI service endpoints failed',
    details: lastError
  });
}
