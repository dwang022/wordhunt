import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getSocket } from '../lib/socket';

export default function LobbyPage() {
  const { profile, user, gameMode, setRoomId } = useStore();
  const navigate = useNavigate();
  const socket = getSocket();

  const [status, setStatus] = useState<'idle' | 'queuing' | 'waiting' | 'creating' | 'joining'>('idle');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [queueTime, setQueueTime] = useState(0);
  const [opponents, setOpponents] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    socket.on('match:queued', () => setStatus('queuing'));
    socket.on('match:found', ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
      navigate('/game');
    });
    socket.on('private:created', ({ code, roomId }: { code: string; roomId: string }) => {
      setRoomCode(code);
      setRoomId(roomId);
      setStatus('waiting');
    });
    socket.on('private:playerJoined', ({ players }: { players: any[] }) => {
      setOpponents(players);
    });
    socket.on('game:start', () => navigate('/game'));
    socket.on('private:error', ({ message }: { message: string }) => {
      setError(message); setStatus('idle');
    });

    return () => {
      socket.off('match:queued');
      socket.off('match:found');
      socket.off('private:created');
      socket.off('private:playerJoined');
      socket.off('game:start');
      socket.off('private:error');
    };
  }, []);

  // Queue timer
  useEffect(() => {
    if (status !== 'queuing') return;
    const interval = setInterval(() => setQueueTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  function startQueue() {
    socket.emit('match:queue', { userId: user!.id, username: profile!.username });
    setStatus('queuing');
    setQueueTime(0);
  }

  function cancelQueue() {
    socket.emit('match:dequeue', { userId: user!.id });
    setStatus('idle');
  }

  function createPrivate() {
    socket.emit('private:create', { userId: user!.id, username: profile!.username });
    setStatus('creating');
  }

  function joinPrivate() {
    if (joinCode.length < 4) { setError('Enter a 4-letter code'); return; }
    socket.emit('private:join', { userId: user!.id, username: profile!.username, code: joinCode.toUpperCase() });
    setStatus('joining');
    setError('');
  }

  return (
    <div className="page" style={{ gap: 20, justifyContent: 'flex-start', paddingTop: 32 }}>
      <button className="btn-ghost" onClick={() => { cancelQueue(); navigate('/'); }}>
        ← Back
      </button>

      {gameMode === 'pvp' && (
        <div style={{ width: '100%' }}>
          <h2 className="font-display" style={{ fontSize: 36, marginBottom: 4 }}>Matchmaking</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            Rating: <strong style={{ color: 'var(--blue)' }}>{Math.round(profile?.elo ?? 1200)}</strong> — matching within ±200 ELO
          </p>

          {status === 'idle' && (
            <button className="btn btn-green" style={{ fontSize: 18 }} onClick={startQueue}>
              🌐 Find Match
            </button>
          )}

          {status === 'queuing' && (
            <div className="card" style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 48 }} className="pulse">⏳</div>
              <div className="font-display" style={{ fontSize: 28 }}>Searching…</div>
              <div style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 24 }}>
                {String(Math.floor(queueTime / 60)).padStart(2, '0')}:{String(queueTime % 60).padStart(2, '0')}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                If no match found in 30s, ELO window widens
              </p>
              <button className="btn btn-secondary" onClick={cancelQueue}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {gameMode === 'private' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 className="font-display" style={{ fontSize: 36 }}>Private Room</h2>

          {/* Create */}
          {status === 'idle' && (
            <>
              <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Create a Room</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Share the code with a friend — same board, race for points!
                </p>
                <button className="btn btn-primary" onClick={createPrivate}>Create Room</button>
              </div>

              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>or</div>

              <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Join a Room</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input font-mono"
                    placeholder="XXXX"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    style={{ flex: 1, textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
                  />
                  <button className="btn btn-green" style={{ width: 'auto', padding: '12px 20px' }} onClick={joinPrivate}>
                    Join
                  </button>
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
              </div>
            </>
          )}

          {/* Waiting for opponent */}
          {(status === 'waiting' || status === 'joining') && (
            <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {status === 'waiting' && roomCode && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
                    Room Code
                  </div>
                  <div className="font-mono" style={{ fontSize: 48, letterSpacing: 12, color: 'var(--blue)' }}>
                    {roomCode}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: 'auto', margin: '0 auto' }}
                    onClick={() => navigator.clipboard.writeText(roomCode)}
                  >
                    Copy Code
                  </button>
                </>
              )}
              <div className="pulse" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                ⏳ Waiting for opponent…
              </div>

              {opponents.length > 0 && (
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                  {opponents.map(p => (
                    <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.username}</span>
                      <span style={{ color: 'var(--blue)' }}>{Math.round(p.elo)} ELO</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-secondary" onClick={() => { navigate('/'); }}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
