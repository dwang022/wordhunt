import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getRank, wordScore } from '../lib/gameLogic';

export default function ResultsPage() {
  const { lastResult, profile, user } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastResult) navigate('/');
  }, []);

  if (!lastResult || !profile || !user) return null;

  const myResult = lastResult.results.find(r => r.userId === user.id);
  const oppResult = lastResult.results.find(r => r.userId !== user.id);
  if (!myResult) return null;

  const pct = Math.round(myResult.pct * 100);
  const won = myResult.won;
  const isSolo = lastResult.results.length === 1;
  const delta = myResult.eloDelta;
  const newElo = myResult.eloAfter;
  const rank = getRank(newElo);

  // Top missed words
  const missed = lastResult.allWords
    .filter(w => !myResult.wordsFound.includes(w))
    .slice(0, 10);

  const bestWord = [...myResult.wordsFound].sort((a, b) => wordScore(b) - wordScore(a))[0];

  return (
    <div className="page" style={{ gap: 20, paddingTop: 24 }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>
          {isSolo ? '🎯' : won ? '🏆' : won === false ? '😞' : '🤝'}
        </div>
        <h1 className="font-display" style={{ fontSize: 52, lineHeight: 1, color: isSolo ? 'var(--text)' : won ? 'var(--green)' : won === false ? 'var(--red)' : 'var(--text)' }}>
          {isSolo ? 'GAME OVER' : won ? 'VICTORY!' : won === false ? 'DEFEAT' : 'DRAW'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {isSolo ? 'Solo rated game' : oppResult ? `vs ${oppResult.username}` : ''}
        </p>
      </div>

      {/* ELO change */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="font-display" style={{ fontSize: 36, color: 'var(--text-muted)' }}>
          {Math.round(myResult.eloBefore)}
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 20 }}>→</div>
        <div className="font-display" style={{ fontSize: 48, color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {Math.round(newElo)}
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, padding: '4px 12px', borderRadius: 8, fontFamily: "'Bebas Neue', sans-serif",
          background: delta >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
          color: delta >= 0 ? 'var(--green)' : 'var(--red)',
        }}>
          {delta >= 0 ? '+' : ''}{delta}
        </div>
      </div>
      <div style={{ color: rank.color, fontWeight: 600, textAlign: 'center', marginTop: -12 }}>
        {rank.icon} {rank.name}
      </div>

      {/* Board completion */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Board completion</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--amber)' : 'var(--red)', borderRadius: 4, transition: 'width 0.6s ease' }} />
        </div>

        {[
          { label: 'Your score', value: myResult.score.toLocaleString(), color: 'var(--green)' },
          ...(oppResult ? [{ label: `${oppResult.username}'s score`, value: oppResult.score.toLocaleString(), color: 'var(--purple)' }] : []),
          { label: 'Max possible', value: lastResult.maxPossible.toLocaleString(), color: 'var(--text)' },
          { label: 'Words found', value: `${myResult.wordsFound.length} / ${lastResult.allWords.length}`, color: 'var(--text)' },
          { label: 'Best word', value: bestWord ? `${bestWord.toUpperCase()} (+${wordScore(bestWord)})` : '—', color: 'var(--amber)' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{row.label}</span>
            <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Missed words */}
      {missed.length > 0 && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Top missed words
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missed.map((w, i) => (
              <div key={w} style={{
                background: i < 3 ? 'var(--red-dim)' : 'var(--surface2)',
                color: i < 3 ? 'var(--red)' : 'var(--text-muted)',
                border: `1px solid ${i < 3 ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`,
                borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 600,
              }}>
                {w.toUpperCase()}
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>+{wordScore(w)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button className="btn btn-primary" onClick={() => navigate('/lobby')}>
          Play Again
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Home
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/leaderboard')}>
          🏆 Leaderboard
        </button>
      </div>
    </div>
  );
}
