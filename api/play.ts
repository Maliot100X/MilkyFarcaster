import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fid, game } = request.body;

  if (!fid) {
    return response.status(400).json({ error: 'Missing FID' });
  }

  try {
    // Fetch User from Supabase
    const { data: user } = await supabase.from('users').select('*').eq('fid', fid).single();
    
    // Default values if user doesn't exist
    const currentXp = user?.xp || 0;
    const metadata = user?.data || {}; // JSONB column for game states
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 hours

    if (game === 'spin') {
      const lastSpin = metadata.lastSpin || 0;

      if (now - lastSpin < cooldown) {
        const remaining = cooldown - (now - lastSpin);
        return response.status(429).json({ 
          error: 'Cooldown active', 
          nextSpin: lastSpin + cooldown,
          remaining 
        });
      }

      // Perform Spin
      const rewards = [
        { type: 'xp', amount: 50 },
        { type: 'xp', amount: 100 },
        { type: 'xp', amount: 500 },
        { type: 'token', amount: 10 },
        { type: 'nothing', amount: 0 }
      ];
      const result = rewards[Math.floor(Math.random() * rewards.length)];
      
      const xpEarned = result.type === 'xp' ? result.amount : 0;
      
      // Update User
      await supabase.from('users').upsert({
          fid: fid,
          xp: currentXp + xpEarned,
          data: { ...metadata, lastSpin: now },
          last_active: new Date().toISOString()
      });

      return response.status(200).json({ 
        result, 
        nextSpin: now + cooldown 
      });
    }

    if (game === 'quiz') {
      const { answers } = request.body;
      if (!answers || !Array.isArray(answers)) {
        return response.status(400).json({ error: 'Missing answers' });
      }

      // Hardcoded Quiz Answers (In real app, fetch from DB)
      const CORRECT_ANSWERS = ['Base', 'Blue', '2023']; 
      
      let score = 0;
      answers.forEach((ans, idx) => {
        if (ans === CORRECT_ANSWERS[idx]) {
          score++;
        }
      });

      const xpEarned = score * 50;
      
      const lastQuiz = metadata.lastQuiz || 0;

      if (now - lastQuiz < cooldown) {
         return response.status(429).json({ error: 'Already played today', nextPlay: lastQuiz + cooldown });
      }
      
      // Update User
      await supabase.from('users').upsert({
          fid: fid,
          xp: currentXp + xpEarned,
          data: { ...metadata, lastQuiz: now },
          last_active: new Date().toISOString()
      });

      return response.status(200).json({
        success: true,
        score,
        totalQuestions: CORRECT_ANSWERS.length,
        xpEarned,
        nextPlay: now + cooldown
      });
    }

    return response.status(400).json({ error: 'Unknown game' });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Server error' });
  }
}
