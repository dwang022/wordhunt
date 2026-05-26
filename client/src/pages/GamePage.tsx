import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getSocket } from '../lib/socket';
import { wordScore } from '../lib/gameLogic';
import GameBoard from '../components/GameBoard';

type WordStatus = 'valid' | 'invalid' | 'already';

interface Toast { word: string; pts: number; status: WordStatus; id: number }

export default function GamePage() {
  const { user, profile, gameMode, roomId, setLastResult, updateProfileElo } = useStore();
  const navigate = useNavigate();
  const socket = getSocket();

  const [board, setBoard] = useState<string[]>([]);
  const [allWords, setAllWords] = useState<string[]>([]);
  const [maxPossible, setMaxPossible] = useState(0);
  const [timeLeft, setTimeLeft] = useState(80);
  const [score, setScore] = useState(0);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [oppScore, setOppScore] = useState(0);
  const [oppName, setOppName] = useState('');
  const [oppWordCount, setOppWordCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'ended'>('waiting');
  const [oppDisconnected, setOppDisconnected] = useState(false);
  const toastId = useRef(0);
  const scoreRef = useRef(0);
  const foundRef = useRef<Set<string>>(new Set());
  const activeRoomId = useRef<string | null>(roomId);  // captures roomId from game:start

  useEffect(() => {
    if (!user || !profile) { navigate('/'); return; }

    if (gameMode === 'solo') {
      socket.emit('solo:start', { userId: user.id, username: profile.username });
    }

    socket.on('game:start', (data: any) => {
      if (data.roomId) activeRoomId.current = data.roomId;
      setBoard(data.board);
      setAllWords(data.allWords);
      setMaxPossible(data.maxPossible);
      setTimeLeft(data.duration ?? 80);
      setScore(0); scoreRef.current = 0;
      setFoundWords(new Set()); foundRef.current = new Set();
      setOppScore(0); setOppWordCount(0);
      setGameActive(true);
      setStatus('playing');

      const opp = data.players?.find((p: any) => p.userId !== user.id);
      if (opp) setOppName(opp.username);
    });

    socket.on('game:tick', ({ timeLeft: t }: { timeLeft: number }) => {
      setTimeLeft(t);
    });

    socket.on('word:result', ({ word, status: s, score: pts, total }: any) => {
      if (s === 'valid') {
        setFoundWords(prev => {
          const n = new Set(prev);
          n.add(word);
          foundRef.current = n;
          return n;
        });
        setScore(total);
        scoreRef.current = total;
        addToast(word, pts, 'valid');
      } else if (s === 'already') {
        addToast(word, 0, 'already');
      } else if (s === 'invalid') {
        addToast(word, 0, 'invalid');
      }
    });

    socket.on('opponent:score', ({ score: s, wordCount }: any) => {
      setOppScore(s);
      setOppWordCount(wordCount);
    });

    socket.on('opponent:disconnected', () => {
      setOppDisconnected(true);
    });

    socket.on('game:end', (data: any) => {
      setGameActive(false);
      setStatus('ended');
      setLastResult(data);

      const myResult = data.results?.find((r: any) => r.userId === user.id);
      if (myResult) {
        updateProfileElo(myResult.eloAfter, myResult.eloDelta, myResult.won);
      }

      navigate('/results');
    });

    socket.on('game:reconnect', (data: any) => {
      if (data.roomId) activeRoomId.current = data.roomId;
      setBoard(data.board);
      setAllWords(data.allWords);
      setMaxPossible(data.maxPossible);
      setTimeLeft(data.timeLeft);
      setScore(data.score); scoreRef.current = data.score;
      setFoundWords(new Set(data.foundWords)); foundRef.current = new Set(data.foundWords);
      setGameActive(true);
      setStatus('playing');
    });

    return () => {
      socket.off('game:start');
      socket.off('game:tick');
      socket.off('word:result');
      socket.off('opponent:score');
      socket.off('opponent:disconnected');
      socket.off('game:end');
      socket.off('game:reconnect');
    };
  }, []);

  function addToast(word: string, pts: number, status: WordStatus) {
    const id = ++toastId.current;
    setToasts(prev => [...prev.slice(-4), { word, pts, status, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 1800);
  }

  function handleWordFound(word: string, pts: number) {
    socket.emit('word:submit', { userId: user!.id, word, roomId: activeRoomId.current });
  }

  function handleWordAttempt(word: string, status: WordStatus) {
    // toasts handled by word:result from server
  }

  const pct = maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 0;
  const timerPct = timeLeft / 80;
  const CIRC = 175.9;
  const timerColor = timeLeft > 20 ? '#58a6ff' : timeLeft > 10 ? '#f0b429' : '#f85149';

  if (status === 'waiting') {
    return (
      <div className="page" style={{ justifyContent: 'center', textAlign: 'center', gap: 20 }}>
        <div style={{ fontSize: 56 }} className="pulse">⏳</div>
        <h2 className="font-display" style={{ fontSize: 36 }}>Waiting for game…</h2>
        <p style={{ color: 'var(--text-muted)' }}>Setting up the board</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ gap: 10, paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="#21262d" strokeWidth="5" />
            <circle cx="32" cy="32" r="28" fill="none" stroke={timerColor} strokeWidth="5"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - timerPct)}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }} />
          </svg>
          <div className="font-display" style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontSize: 22, color: timerColor
          }}>
            {timeLeft}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: 52, color: 'var(--green)', lineHeight: 1 }}>
            {score.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
            {foundWords.size} word{foundWords.size !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{pct}% of board</div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 70 }}>
          {gameMode !== 'solo' && oppName ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{oppName}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--purple)' }}>{oppScore.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{oppWordCount} words</div>
              {oppDisconnected && <div style={{ fontSize: 10, color: 'var(--amber)' }}>disconnected</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Rating</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>{Math.round(profile?.elo ?? 1200)}</div>
            </>
          )}
        </div>
      </div>

      <GameBoard
        board={board}
        onWordFound={handleWordFound}
        onWordAttempt={handleWordAttempt}
        foundWords={foundWords}
        active={gameActive}
      />

      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
          Found words
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 88, overflowY: 'auto' }}>
          {[...foundWords].reverse().map(w => (
            <div key={w} className="pop" style={{
              background: 'var(--green-dim)', color: 'var(--green)',
              border: '1px solid var(--green-border)', borderRadius: 8,
              padding: '3px 10px', fontSize: 13, fontWeight: 600,
            }}>
              {w.toUpperCase()} <span style={{ fontSize: 11, opacity: 0.7 }}>+{wordScore(w)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 6, zIndex: 99, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="pop font-mono" style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 15, fontWeight: 700,
            textAlign: 'center', whiteSpace: 'nowrap',
            background: t.status === 'valid' ? 'var(--green-dim)' : t.status === 'already' ? 'var(--amber-dim)' : 'var(--red-dim)',
            color: t.status === 'valid' ? 'var(--green)' : t.status === 'already' ? 'var(--amber)' : 'var(--red)',
            border: `1px solid ${t.status === 'valid' ? 'var(--green-border)' : t.status === 'already' ? 'rgba(240,180,41,0.3)' : 'rgba(248,81,73,0.3)'}`,
          }}>
            {t.word.toUpperCase()}{t.status === 'valid' ? ` +${t.pts}` : t.status === 'already' ? ' ✓' : ' ✗'}
          </div>
        ))}
      </div>
    </div>
  );
}
