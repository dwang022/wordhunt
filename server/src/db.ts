import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;

if (!url || !key) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — DB features disabled');
}

export const supabase = createClient(url || 'http://localhost', key || 'placeholder', {
  auth: { persistSession: false }
});

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: string, username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true })
    .select()
    .single();
  if (error) console.error('getOrCreateProfile:', error.message);
  return data;
}

export async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function updateElo(userId: string, delta: number, won: boolean | null) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('elo, wins, losses, win_streak, best_score, total_games')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  const newElo = Math.max(100, profile.elo + delta);
  const newStreak = won === true ? profile.win_streak + 1 : won === false ? 0 : profile.win_streak;

  const { data } = await supabase
    .from('profiles')
    .update({
      elo: newElo,
      wins: won === true ? profile.wins + 1 : profile.wins,
      losses: won === false ? profile.losses + 1 : profile.losses,
      win_streak: newStreak,
      total_games: profile.total_games + 1,
    })
    .eq('id', userId)
    .select()
    .single();

  return data;
}

export async function recordGame(game: {
  player_id: string;
  opponent_id?: string;
  mode: string;
  score: number;
  opponent_score?: number;
  max_possible: number;
  words_found: string[];
  elo_before: number;
  elo_after: number;
  board: string[];
  won: boolean | null;
}) {
  const { error } = await supabase.from('games').insert(game);
  if (error) console.error('recordGame:', error.message);
}

export async function updateBestScore(userId: string, score: number) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('best_score, total_score, total_words')
    .eq('id', userId)
    .single();
  if (!profile) return;
  if (score > profile.best_score) {
    await supabase.from('profiles').update({ best_score: score }).eq('id', userId);
  }
}

export async function getLeaderboard(limit = 50) {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, elo, wins, losses, best_score, win_streak, total_games')
    .order('elo', { ascending: false })
    .limit(limit);
  return data ?? [];
}
