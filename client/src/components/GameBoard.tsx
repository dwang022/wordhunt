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

  const currentWord = path.map(i => board[i].toLowerCase()).join('');

  const getTileAt = useCallback((x: number, y: number): number => {
    for (let i = 0; i < 16; i++) {
      const el = tileRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return -1;
  }, []);

  const drawPathFromRef = useCallback(() => {
    const svg = svgRef.current;
    const wrapper = wrapperRef.current;
    if (!svg || !wrapper) return;
    svg.innerHTML = '';
    const wr = wrapper.getBoundingClientRect();
    const p = pathRef.current;
    for (let i = 1; i < p.length; i++) {
      const a = tileRefs.current[p[i - 1]]?.getBoundingClientRect();
      const b = tileRefs.current[p[i]]?.getBoundingClientRect();
      if (!a || !b) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.left - wr.left + a.width / 2));
      line.setAttribute('y1', String(a.top - wr.top + a.height / 2));
      line.setAttribute('x2', String(b.left - wr.left + b.width / 2));
      line.setAttribute('y2', String(b.top - wr.top + b.height / 2));
      line.setAttribute('stroke', '#3b82f6');
      line.setAttribute('stroke-width', '5');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.7');
      svg.appendChild(line);
    }
  }, []);

  const startDrag = useCallback((x: number, y: number) => {
    if (!active) return;
    const i = getTileAt(x, y);
    if (i < 0) return;
    dragging.current = true;
    pathRef.current = [i];
    setPath([i]);
    drawPathFromRef();
  }, [active, getTileAt, drawPathFromRef]);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragging.current || !active) return;
    const i = getTileAt(x, y);
    if (i < 0) return;

    const prev = pathRef.current;
    if (prev.length === 0) return;
    const last = prev[prev.length - 1];
    if (i === last) return;

    // Backtrack
    if (prev.length >= 2 && i === prev[prev.length - 2]) {
      const next = prev.slice(0, -1);
      pathRef.current = next;
      setPath(next);
      drawPathFromRef();
      return;
    }

    if (prev.includes(i)) return;
    if (!isAdjacent(last, i)) return;

    const next = [...prev, i];
    pathRef.current = next;
    setPath(next);
    drawPathFromRef();
  }, [active, getTileAt, drawPathFromRef]);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

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

  // Attach touch events directly to DOM to use passive:false (prevents scroll)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // critical — stops page scroll during swipe
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      endDrag();
    };
    const onTouchCancel = (e: TouchEvent) => {
      e.preventDefault();
      endDrag();
    };

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
  }, [startDrag, moveDrag, endDrag]);

  const wordValid = currentWord.length >= 3 && isWord(currentWord);
  const wordAlready = foundWords.has(currentWord);
  const wordPartial = currentWord.length > 0 && hasPrefix(currentWord);

  let bubbleStyle: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '2px solid var(--border)',
    color: 'var(--text-muted)',
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
      {/* Word bubble */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div
          className="font-mono"
          style={{
            ...bubbleStyle,
            borderRadius: 28,
            padding: '10px 24px',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            minWidth: 140,
            textAlign: 'center',
            transition: 'all 0.1s',
          }}
        >
          {currentWord.toUpperCase() || '—'}
        </div>
      </div>

      {/* Grid — touch-action:none is critical to stop iOS scroll stealing */}
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          touchAction: 'none',       /* prevents scroll hijack on iOS */
          userSelect: 'none',
          WebkitUserSelect: 'none',
          width: '100%',
          maxWidth: 380,
        }}
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onMouseMove={e => { if (dragging.current) moveDrag(e.clientX, e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <svg
          ref={svgRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 1,
          }}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          width: '100%',
        }}>
          {board.map((letter, i) => {
            const isActive = path[path.length - 1] === i;
            const isInPath = path.includes(i) && !isActive;

            return (
              <div
                key={i}
                ref={el => { tileRefs.current[i] = el; }}
                style={{
                  aspectRatio: '1',
                  background: isActive ? 'var(--tile-active)' : isInPath ? '#1e3a5f' : 'var(--tile-bg)',
                  border: `2px solid ${isActive ? '#3b82f6' : isInPath ? '#2563eb' : 'var(--tile-border)'}`,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(24px, 7vw, 34px)',
                  color: isActive ? '#fff' : isInPath ? 'var(--blue)' : 'var(--text)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.08s, background 0.08s, border-color 0.08s',
                  boxShadow: isActive ? '0 0 16px var(--tile-glow)' : 'none',
                  zIndex: isActive ? 2 : 1,
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
