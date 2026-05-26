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
  const gridBounds = useRef<{ left: number; top: number; cellW: number; cellH: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const currentWord = path.map(i => board[i].toLowerCase()).join('');

  const computeGrid = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const r = wrapper.getBoundingClientRect();
    gridBounds.current = {
      left: r.left,
      top: r.top,
      cellW: r.width / 4,
      cellH: r.height / 4,
    };
    tileCenters.current = tileRefs.current.map(el => {
      if (!el) return { x: 0, y: 0 };
      const tr = el.getBoundingClientRect();
      return { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(computeGrid, 80);
    window.addEventListener('resize', computeGrid);
    return () => { clearTimeout(t); window.removeEventListener('resize', computeGrid); };
  }, [computeGrid]);

  const getTileFromPoint = useCallback((x: number, y: number): number => {
    const g = gridBounds.current;
    if (!g) return -1;
    const margin = g.cellW * 0.35;
    if (
      x < g.left - margin || x > g.left + g.cellW * 4 + margin ||
      y < g.top - margin || y > g.top + g.cellH * 4 + margin
    ) return -1;
    const col = Math.min(3, Math.max(0, Math.floor((x - g.left) / g.cellW)));
    const row = Math.min(3, Math.max(0, Math.floor((y - g.top) / g.cellH)));
    return row * 4 + col;
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
    computeGrid();
    const tile = getTileFromPoint(x, y);
    if (tile < 0) return;

    dragging.current = true;
    // Critical: set lastPos to EXACTLY the touch start point
    // so the first moveDrag interpolates FROM here, not losing the start tile
    lastPos.current = { x, y };
    pathRef.current = [tile];
    setPath([tile]);
    drawPathFromRef();
  }, [active, getTileFromPoint, drawPathFromRef, computeGrid]);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragging.current || !active) return;

    // Always interpolate from lastPos to current point
    // This guarantees the start tile is never skipped on the first move
    const from = lastPos.current!;
    lastPos.current = { x, y };

    const dx = x - from.x;
    const dy = y - from.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) return; // ignore micro-movements

    // Sample every 4px along the swipe line
    const steps = Math.max(1, Math.ceil(dist / 4));
    let changed = false;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sx = from.x + dx * t;
      const sy = from.y + dy * t;
      const tile = getTileFromPoint(sx, sy);
      if (tile >= 0 && processTile(tile)) changed = true;
    }

    if (changed) {
      setPath([...pathRef.current]);
      drawPathFromRef();
    }
  }, [active, getTileFromPoint, processTile, drawPathFromRef]);

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
      computeGrid();
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
  }, [startDrag, moveDrag, endDrag, computeGrid]);

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
          width: '100%',
          maxWidth: '100%',
        }}
        onMouseDown={e => { computeGrid(); startDrag(e.clientX, e.clientY); }}
        onMouseMove={e => { if (dragging.current) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <svg ref={svgRef} style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 5,
          width: '100%',
        }}>
          {board.map((letter, i) => {
            const isActive = path[path.length - 1] === i;
            const isInPath = path.includes(i) && !isActive;
            return (
              <div key={i} ref={el => { tileRefs.current[i] = el; }} style={{
                aspectRatio: '1',
                background: isActive ? 'var(--tile-active)' : isInPath ? '#1e3a5f' : 'var(--tile-bg)',
                border: `2px solid ${isActive ? '#3b82f6' : isInPath ? '#2563eb' : 'var(--tile-border)'}`,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(28px, 8.5vw, 38px)',
                color: isActive ? '#fff' : isInPath ? 'var(--blue)' : 'var(--text)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
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
