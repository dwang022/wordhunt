import { useEffect, useRef, useState, useCallback } from 'react';
import { isWord, hasPrefix, wordScore, isAdjacent } from '../lib/gameLogic';

interface Props {
  board: string[];
  onWordFound: (word: string, score: number) => void;
  onWordAttempt: (word: string, status: 'valid' | 'invalid' | 'already') => void;
  foundWords: Set<string>;
  active: boolean;
}

export default function GameBoard({ board, onWordFound, onWordAttempt, foundWords, active }: Props) {
  const [path, setPath] = useState<number[]>([]);
  const dragging = useRef(false);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<number[]>([]);
  const tileCenters = useRef<{ x: number; y: number }[]>([]);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const currentWord = path.map(i => board[i].toLowerCase()).join('');

  const computeTileCenters = useCallback(() => {
    tileCenters.current = tileRefs.current.map(el => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(computeTileCenters, 80);
    window.addEventListener('resize', computeTileCenters);
    return () => { clearTimeout(t); window.removeEventListener('resize', computeTileCenters); };
  }, [computeTileCenters]);

  // Simple nearest tile — no direction bias, just pure distance
  const getNearestTile = useCallback((x: number, y: number): number => {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < 16; i++) {
      const c = tileCenters.current[i];
      if (!c) continue;
      const dist = Math.hypot(x - c.x, y - c.y);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }, []);

  const drawPathFromRef = useCallback(() => {
    const svg = svgRef.current;
    const wrapper = wrapperRef.current;
    if (!svg || !wrapper) return;
    svg.innerHTML = '';
    const wr = wrapper.getBoundingClientRect();
    const p = pathRef.current;
    for (let i = 1; i < p.length; i++) {
      const a = tileCenters.current[p[i - 1]];
      const b = tileCenters.current[p[i]];
      if (!a || !b) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.x - wr.left));
      line.setAttribute('y1', String(a.y - wr.top));
      line.setAttribute('x2', String(b.x - wr.left));
      line.setAttribute('y2', String(b.y - wr.top));
      line.setAttribute('stroke', '#3b82f6');
      line.setAttribute('stroke-width', '6');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.85');
      svg.appendChild(line);
    }
  }, []);

  // Process a single point — try to add nearest tile to path
  const processPoint = useCallback((x: number, y: number) => {
    const nearest = getNearestTile(x, y);
    if (nearest < 0) return false;

    const prev = pathRef.current;
    if (prev.length === 0) return false;
    const last = prev[prev.length - 1];

    if (nearest === last) return false;

    // Backtrack
    if (prev.length >= 2 && nearest === prev[prev.length - 2]) {
      pathRef.current = prev.slice(0, -1);
      return true;
    }

    if (prev.includes(nearest)) return false;
    if (!isAdjacent(last, nearest)) return false;

    pathRef.current = [...prev, nearest];
    return true;
  }, [getNearestTile]);

  const startDrag = useCallback((x: number, y: number) => {
    if (!active) return;
    computeTileCenters();
    const nearest = getNearestTile(x, y);
    if (nearest < 0) return;
    dragging.current = true;
    lastPos.current = { x, y };
    pathRef.current = [nearest];
    setPath([nearest]);
    drawPathFromRef();
  }, [active, getNearestTile, drawPathFromRef, computeTileCenters]);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragging.current || !active) return;

    const from = lastPos.current || { x, y };
    lastPos.current = { x, y };

    const dx = x - from.x;
    const dy = y - from.y;
    const dist = Math.hypot(dx, dy);

    // Interpolate along the movement line — sample every 6px
    // This is what makes fast diagonal swipes work
    const steps = Math.max(1, Math.ceil(dist / 6));
    let changed = false;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sx = from.x + dx * t;
      const sy = from.y + dy * t;
      if (processPoint(sx, sy)) changed = true;
    }

    if (changed) {
      setPath([...pathRef.current]);
      drawPathFromRef();
    }
  }, [active, processPoint, drawPathFromRef]);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    lastPos.current = null;

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
    if (svgRef.current) svgRef.current.innerHTML = '';
  }, [board, foundWords, onWordFound, onWordAttempt]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      computeTileCenters();
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
  }, [startDrag, moveDrag, endDrag, computeTileCenters]);

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

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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

      <div
        ref={wrapperRef}
        style={{
          position: 'relative', touchAction: 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
          width: '100%', maxWidth: 420, padding: 2,
        }}
        onMouseDown={e => { computeTileCenters(); startDrag(e.clientX, e.clientY); }}
        onMouseMove={e => { if (dragging.current) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <svg ref={svgRef} style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, width: '100%' }}>
          {board.map((letter, i) => {
            const isActive = path[path.length - 1] === i;
            const isInPath = path.includes(i) && !isActive;
            return (
              <div key={i} ref={el => { tileRefs.current[i] = el; }} style={{
                aspectRatio: '1',
                background: isActive ? 'var(--tile-active)' : isInPath ? '#1e3a5f' : 'var(--tile-bg)',
                border: `2px solid ${isActive ? '#3b82f6' : isInPath ? '#2563eb' : 'var(--tile-border)'}`,
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(28px, 8.5vw, 38px)',
                color: isActive ? '#fff' : isInPath ? 'var(--blue)' : 'var(--text)',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform 0.06s, background 0.06s, border-color 0.06s',
                boxShadow: isActive ? '0 0 20px var(--tile-glow)' : 'none',
                zIndex: isActive ? 2 : 1, position: 'relative',
              }}>
                {letter}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
