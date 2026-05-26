import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setProfile } = useStore();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let data;
      if (mode === 'signup') {
        data = await api.signup(email, password, username);
      } else {
        data = await api.signin(email, password);
      }
      setUser(data.user, data.session?.access_token ?? null);
      const profile = await api.getProfile(data.user.id);
      setProfile(profile);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function guestLogin() {
    setLoading(true); setError('');
    try {
      const data = await api.guest();
      setUser(data.user, data.session?.access_token ?? null);
      // Create a guest profile
      const guestName = 'Guest' + Math.floor(Math.random() * 9999);
      setProfile({
        id: data.user.id, username: guestName, elo: 1200,
        wins: 0, losses: 0, win_streak: 0, best_score: 0, total_games: 0
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🔤</div>
        <h1 className="font-display" style={{ fontSize: 48, lineHeight: 1 }}>WORD HUNT</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' }}>Rated · Competitive</p>
      </div>

      <div className="card" style={{ maxWidth: 380 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['signin', 'signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className="btn btn-sm"
              style={{
                flex: 1, background: mode === m ? 'var(--blue)' : 'var(--surface2)',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                border: mode === m ? 'none' : '1px solid var(--border)',
              }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input className="input" placeholder="Username" value={username}
              onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} />
          )}
          <input className="input" type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6} />

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-dim)', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <div className="divider" />
          <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>or</span>
          <div className="divider" />
        </div>

        <button className="btn btn-secondary" onClick={guestLogin} disabled={loading}>
          Play as Guest
        </button>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Guest progress is saved locally only
        </p>
      </div>
    </div>
  );
}
