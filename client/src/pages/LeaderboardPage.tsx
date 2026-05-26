import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getRank } from '../lib/gameLogic';
import { useStore } from '../lib/store';

interface Entry {
  id: string; username: string; elo: number;
  wins: number; losses: number; best_score: number;
  win_streak: number; total_games: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.getLeaderboard().then(data => { setEntries(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="page" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
        <button className="btn-ghost" onClick={() => navigate('/')}>←</button>
        <h1 className="font-display" style={{ fontSize: 36 }}>🏆 Leaderboard</h1>
      </div>

      {loading ? (
        <div className="pulse" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((e, i) => {
            const rank = getRank(e.elo);
            const isMe = e.id === user?.id;
            const winRate = e.total_games > 0 ? Math.round((e.wins / e.total_games) * 100) : 0;

            return (
              <div key={e.id} style={{
                background: isMe ? 'rgba(88,166,255,0.08)' : 'var(--surface)',
                border: `1px solid ${isMe ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {/* Rank number */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? '#3a2a00' : i === 1 ? '#2a2a2a' : i === 2 ? '#2a1800' : 'var(--surface2)',
                  color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, fontWeight: 700,
                }}>
                  {i + 1}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.username}
                    </span>
                    {isMe && <span className="badge badge-blue" style={{ fontSize: 9 }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 12, color: rank.color }}>
                    {rank.icon} {rank.name}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-display" style={{ fontSize: 24, color: 'var(--blue)', lineHeight: 1 }}>
                    {Math.round(e.elo)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {e.wins}W {e.losses}L · {winRate}%
                  </div>
                </div>
              </div>
            );
          })}

          {entries.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No players yet — be the first!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
