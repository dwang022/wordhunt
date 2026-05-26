import { useEffect, useRef, useState, useCallback } from 'react';
import { isWord, hasPrefix, wordScore, isAdjacent } from '../lib/gameLogic';

interface Props {
  board: string[];
  onWordFound: (word: string, score: number) => void;
  onWordAttempt: (word: string, status: 'valid' | 'invalid' | 'already') => void;
  foundWords: Set<string>;
  active: boolean;
}

// Tile size in px — set once on mount based on screen width
const GRID_COLS = 4;
const GAP = 8;

export default function GameBoard({ board, onWordFound, onWordAttempt, foundWords, active }: Props) {
  const [path, setPath] = useState<number[]>([]);
  const [tileSize, setTileSize] = useState(80);
  const dragging = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathRef = useRef<number[]>([]);
  const tileSizeRef = useRef(80);
  const gridOrigin = useRef({ x: 0, y: 0 });
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const animRef = useRef<number>(0);

  const currentWord = path.map(i => board[i].toLowerCase()).join('');

  // Compute tile size from wrapper width
  const computeLayout = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const w = wrapper.getBoundingClientRect().width;
    const size = Math.floor((w - GAP * (GRID_COLS - 1)) / GRID_COLS);
    tileSizeRef.current = size;
    setTileSize(size);
    const rect = wrapper.getBoundingClientRect();
    gridOrigin.current = { x: rect.left, y: rect.top };
  }, []);

  useEffect(() => {
    const t = setTimeout(computeLayout, 60);
    window.addEventListener('resize', computeLayout);
    return () => { clearTimeout(t); window.removeEventListener('resize', computeLayout); };
  }, [computeLayout]);

  // Convert screen point → tile index using expanded hit zones
  // Each tile's hit zone extends BEYOND its visual boundary by `expand` px
  // so neighboring zones overlap — this eliminates dead zones entirely
  const getTile = useCallback((screenX: number, screenY: number): number => {
    const origin = gridOrigin.current;
    const size = tileSizeRef.current;
    const step = size + GAP; // distance between tile centers

    // Map screen coords to grid-local coords
    const lx = screenX - origin.x;
    const ly = screenY - origin.y;

    // Find the nearest tile center
    // Each tile center is at: col * step + size/2, row * step + size/2
    let best = -1;
    let bestDist = Infinity;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = col * step + size / 2;
        const cy = row * step + size / 2;
        const dist = Math.hypot(lx - cx, ly - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = row * 4 + col;
        }
      }
    }

    // Only return tile if within generous range (step * 0.75 catches all diagonals)
    // step * 0.75 = 75% of the distance between tile centers
    // For a 80px tile with 8px gap = 88px step → range = 66px
    // Diagonal distance between adjacent centers = step * sqrt(2) ≈ 124px
    // So we use a bigger threshold for actual detection: step * 0.9
    if (bestDist > step * 0.9) return -1;
    return best;
  }, []);

  // Draw path lines on canvas overlay
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = tileSizeRef.current;
    const step = size + GAP;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const p = pathRef.current;
    if (p.length < 2) return;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();

    for (let i = 0; i < p.length; i++) {
      const col = p[i] % 4;
      const row = Math.floor(p[i] / 4);
      const cx = col * step + size / 2;
      const cy = row * step + size / 2;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }, []);

  const processTile = useCallback((tile: number): boolean => {
    const prev = pathRef.current;
    if (prev.length === 0) return false;
    const last = prev[prev.length - 1];
    if (tile === last) return false;
    // Backtrack
    if (prev.length >= 2 && tile === prev[prev.length - 2]) {
      pathRef.current = prev.slice(0, -1);
      return true;
    }
    if (prev.includes(tile)) return false;
    if (!isAdjacent(last, tile)) return false;
    pathRef.current = [...prev, tile];
    return true;
  }, []);

  const startDrag = useCallback((x: number, y: number) => {
    if (!active) return;
    computeLayout();

    // Refresh grid origin every drag start (handles scroll/layout changes)
    const wrapper = wrapperRef.current;
    if (wrapper) gridOrigin.current = { x: wrapper.getBoundingClientRect().left, y: wrapper.getBoundingClientRect().top };

    const tile = getTile(x, y);
    if (tile < 0) return;

    dragging.current = true;
    lastPos.current = { x, y };
    pathRef.current = [tile];
    setPath([tile]);
    drawCanvas();
  }, [active, getTile, drawCanvas, computeLayout]);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragging.current || !active) return;

    const from = lastPos.current!;
    lastPos.current = { x, y };

    const dx = x - from.x;
    const dy = y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    // Sample every 3px — very fine to catch all diagonal crossings
    const steps = Math.max(1, Math.ceil(dist / 3));
    let changed = false;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const tile = getTile(from.x + dx * t, from.y + dy * t);
      if (tile >= 0 && processTile(tile)) changed = true;
    }

    if (changed) {
      setPath([...pathRef.current]);
      // Use rAF to batch canvas redraws
      cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(drawCanvas);
    }
  }, [active, getTile, processTile, drawCanvas]);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    lastPos.current = null;
    cancelAnimationFrame(animRef.current);

    const p = pathRef.current;
    const word = p.map(i => board[i].toLowerCase()).join('');

    if (word.length >= 3) {
      if (foundWords.has(word)) {
        onWordAttempt(word, 'already');
      } else if (isWord(word)) {
        onWordFound(word, wordScore(word));
        onWordAttempt(word, 'valid');
      } else {
        onWordAttempt(word, 'invalid');
      }
    }

    pathRef.current = [];
    setPath([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [board, foundWords, onWordFound, onWordAttempt]);

  // Resize canvas when tileSize changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const w = wrapper.getBoundingClientRect().width;
    const h = tileSize * 4 + GAP * 3;
    canvas.width = w;
    canvas.height = h;
  }, [tileSize]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const wrapper = wrapperRef.current;
      if (wrapper) gridOrigin.current = { x: wrapper.getBoundingClientRect().left, y: wrapper.getBoundingClientRect().top };
      computeLayout();
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); endDrag(); };
    const onTouchCancel = (e: TouchEvent) => { e.preventDefault(); endDrag(); };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchCancel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [startDrag, moveDrag, endDrag, computeLayout]);

  const wordValid = currentWord.length >= 3 && isWord(currentWord);
  const wordAlready = foundWords.has(currentWord);
  const wordPartial = currentWord.length > 0 && hasPrefix(currentWord);

  let bubbleStyle: React.CSSProperties = {
    background: 'var(--surface2)', border: '2px solid var(--border)', color: 'var(--text-muted)',
  };
  if (wordAlready) {
    bubbleStyle = { background: 'var(--amber-dim)', border: '2px solid var(--amber)', color: 'var(--amber)' };
  } else if (wordValid) {
    bubbleStyle = { background: 'var(--green-dim)', border: '2px solid var(--green)', color: 'var(--green)' };
  } else if (currentWord.length > 0 && !wordPartial) {
    bubbleStyle = { background: 'var(--red-dim)', border: '2px solid var(--red)', color: 'var(--red)' };
  }

  const gridHeight = tileSize * 4 + GAP * 3;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Word bubble */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div className="font-mono" style={{
          ...bubbleStyle, borderRadius: 28, padding: '10px 24px',
          fontSize: 22, fontWeight: 700, letterSpacing: 4,
          minWidth: 140, textAlign: 'center',
          transition: 'background 0.08s, border-color 0.08s, color 0.08s',
        }}>
          {currentWord.toUpperCase() || '—'}
        </div>
      </div>

      {/* Grid — full width, canvas overlay for lines */}
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          width: '100%',
          height: gridHeight,
        }}
        onMouseDown={e => {
          const wrapper = wrapperRef.current;
          if (wrapper) gridOrigin.current = { x: wrapper.getBoundingClientRect().left, y: wrapper.getBoundingClientRect().top };
          computeLayout();
          startDrag(e.clientX, e.clientY);
        }}
        onMouseMove={e => { if (dragging.current) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {/* Canvas for drawing path lines — sits above tiles */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10,
          }}
        />

        {/* Tiles positioned absolutely for precise layout */}
        {board.map((letter, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const isActive = path[path.length - 1] === i;
          const isInPath = path.includes(i) && !isActive;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: col * (tileSize + GAP),
                top: row * (tileSize + GAP),
                width: tileSize,
                height: tileSize,
                background: isActive ? 'var(--tile-active)' : isInPath ? '#1e3a5f' : 'var(--tile-bg)',
                border: `2px solid ${isActive ? '#3b82f6' : isInPath ? '#2563eb' : 'var(--tile-border)'}`,
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: Math.round(tileSize * 0.42),
                color: isActive ? '#fff' : isInPath ? 'var(--blue)' : 'var(--text)',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.06s, background 0.06s, border-color 0.06s',
                boxShadow: isActive ? '0 0 24px var(--tile-glow)' : 'none',
                zIndex: isActive ? 2 : 1,
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}
