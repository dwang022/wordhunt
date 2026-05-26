import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getRank } from '../lib/gameLogic';
import { api } from '../lib/api';
import { connectSocket } from '../lib/socket';

export default function HomePage() {
  const { profile, setProfile, user, logout, setGameMode } = useStore();
  const navigate = useNavigate();
  const elo = profile?.elo ?? 1200;
  const rank = getRank(elo);

  useEffect(() => {
    if (!user || !profile) return;
    connectSocket(user.id, profile.username);
    // Refresh profile from server
    api.getProfile(user.id).then(p => { if (p) setProfile(p); }).catch(() => {});
  }, [user?.id]);

  function startSolo() {
    setGameMode('solo');
    navigate('/game');
  }

  function startMatchmaking() {
    setGameMode('pvp');
    navigate('/lobby');
  }

  function startPrivate() {
    setGameMode('private');
    navigate('/lobby');
  }

  if (!profile) return null;

  const winRate = profile.total_games > 0
    ? Math.round((profile.wins / profile.total_games) * 100)
    : 0;

  return (
    <div className="page" style={{ gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 36, lineHeight: 1 }}>🔤 WORD HUNT</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Rated · Competitive</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profile.username}</div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { logout(); navigate('/auth'); }}>
            Sign out
          </button>
        </div>
      </div>

      {/* ELO Card */}
      <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #161b22, #1a2744)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
          Your Rating
        </div>
        <div className="font-display" style={{ fontSize: 72, color: 'var(--blue)', lineHeight: 1 }}>
          {Math.round(elo)}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: rank.color, marginBottom: 12 }}>
          {rank.icon} {rank.name}
        </div>

        {/* Rank progress bar */}
        <RankProgress elo={elo} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, fontSize: 14 }}>
          <div><span style={{ color: 'var(--green)', fontWeight: 700 }}>{profile.wins}W</span><span style={{ color: 'var(--text-muted)' }}> – </span><span style={{ color: 'var(--red)', fontWeight: 700 }}>{profile.losses}L</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Win rate: <span style={{ color: 'var(--text)' }}>{winRate}%</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Streak: <span style={{ color: 'var(--amber)' }}>🔥{profile.win_streak}</span></div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {[
          { label: 'Best Score', value: profile.best_score.toLocaleString(), color: 'var(--amber)' },
          { label: 'Games', value: profile.total_games, color: 'var(--blue)' },
          { label: 'Win Streak', value: `🔥${profile.win_streak}`, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Play buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <button className="btn btn-primary" style={{ fontSize: 18, padding: '16px' }} onClick={startSolo}>
          ⚡ Solo Rated
        </button>
        <button className="btn btn-green" style={{ fontSize: 18, padding: '16px' }} onClick={startMatchmaking}>
          🌐 Matchmaking
        </button>
        <button className="btn btn-secondary" onClick={startPrivate}>
          🔗 Private Room
        </button>
      </div>

      {/* Mode explanations */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          How ELO works
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <div>⚡ <strong style={{ color: 'var(--text)' }}>Solo</strong> — ELO adjusts based on % of board's max possible score you find</div>
          <div>🌐 <strong style={{ color: 'var(--text)' }}>Matchmaking</strong> — Paired within ±200 ELO, standard win/loss formula</div>
          <div>🔗 <strong style={{ color: 'var(--text)' }}>Private</strong> — Same board, ELO awarded based on score difference</div>
        </div>
      </div>

      <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => navigate('/leaderboard')}>
        🏆 View Leaderboard
      </button>
    </div>
  );
}

function RankProgress({ elo }: { elo: number }) {
  const ranks = [
    { name: 'Novice', min: 0, max: 999, color: '#8b8bff' },
    { name: 'Scholar', min: 1000, max: 1199, color: '#7dff7d' },
    { name: 'Wordsmith', min: 1200, max: 1499, color: '#ffdd7d' },
    { name: 'Lexicon', min: 1500, max: 1799, color: '#ff9d7d' },
    { name: 'Grandmaster', min: 1800, max: 2400, color: '#dd7dff' },
  ];
  const current = ranks.find(r => elo >= r.min && elo <= r.max) ?? ranks[4];
  const next = ranks[ranks.indexOf(current) + 1];
  const pct = next ? Math.round(((elo - current.min) / (next.min - current.min)) * 100) : 100;

  return (
    <div>
      <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', margin: '0 20px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: current.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      {next && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
          {next.min - elo} pts to <span style={{ color: next.color }}>{next.name}</span>
        </div>
      )}
    </div>
  );
}
