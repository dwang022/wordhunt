import { Router } from 'express';
import { supabase, getLeaderboard, getProfile } from './db.js';
import { WORD_LIST } from './gameLogic.js';

const router = Router();

// ─── Words endpoint (serves dictionary to client) ─────────────────────────────
router.get('/words', (req, res) => {
  res.json(WORD_LIST);
});

// ─── Auth ────────────────────────────────────────────────────────────────────
router.post('/auth/anonymous', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    res.json({ user: data.user, session: data.session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/signup', async (req, res) => {
  const { email, password, username } = req.body;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, username: username || email.split('@')[0], elo: 1200,
        wins: 0, losses: 0, win_streak: 0, best_score: 0, total_games: 0
      });
    }
    res.json({ user: data.user, session: data.session });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ user: data.user, session: data.session });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// ─── Profile ─────────────────────────────────────────────────────────────────
router.get('/profile/:userId', async (req, res) => {
  const data = await getProfile(req.params.userId);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

router.patch('/profile/:userId', async (req, res) => {
  const { username } = req.body;
  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', req.params.userId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const data = await getLeaderboard(limit);
  res.json(data);
});

// ─── Game history ─────────────────────────────────────────────────────────────
router.get('/games/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('player_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
