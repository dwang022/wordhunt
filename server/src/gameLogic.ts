import wordListPkg from 'wordlist-english';

// 82,000+ real English words, 3-10 letters, no proper nouns or abbreviations
const wordList = (wordListPkg as any)['english'] as string[];
export const WORD_LIST: string[] = wordList.filter(
  w => w.length >= 3 && w.length <= 10 && /^[a-z]+$/.test(w)
);

// ─── Trie ─────────────────────────────────────────────────────────────────────
interface TrieNode { [key: string]: TrieNode | boolean; $?: boolean }

export function buildTrie(words: string[]): TrieNode {
  const root: TrieNode = {};
  for (const word of words) {
    let node = root;
    for (const ch of word) {
      if (!node[ch]) node[ch] = {} as TrieNode;
      node = node[ch] as TrieNode;
    }
    node.$ = true;
  }
  return root;
}

export const TRIE = buildTrie(WORD_LIST);

export function isWord(word: string, trie = TRIE): boolean {
  let node = trie;
  for (const ch of word) {
    if (!node[ch]) return false;
    node = node[ch] as TrieNode;
  }
  return !!node.$;
}

export function hasPrefix(prefix: string, trie = TRIE): boolean {
  let node = trie;
  for (const ch of prefix) {
    if (!node[ch]) return false;
    node = node[ch] as TrieNode;
  }
  return true;
}

// ─── Letter generation (GamePigeon-style frequencies) ─────────────────────────
const LETTERS = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSSSTTTTTTUUUUVVWWXYYZ';

export function generateBoard(): string[] {
  return Array.from({ length: 16 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]);
}

// ─── Scoring (exact GamePigeon values) ────────────────────────────────────────
const SCORE_MAP: Record<number, number> = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8: 2200 };

export function wordScore(word: string): number {
  const len = Math.min(word.length, 8);
  return SCORE_MAP[len] ?? 2200;
}

// ─── Find all valid words on a board ─────────────────────────────────────────
export function findAllWords(board: string[]): string[] {
  const found = new Set<string>();
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

  function dfs(r: number, c: number, visited: Set<number>, word: string, node: TrieNode) {
    if (node.$ && word.length >= 3) found.add(word);
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= 4 || nc < 0 || nc >= 4) continue;
      const ni = nr * 4 + nc;
      if (visited.has(ni)) continue;
      const ch = board[ni].toLowerCase();
      if (!node[ch]) continue;
      visited.add(ni);
      dfs(nr, nc, visited, word + ch, node[ch] as TrieNode);
      visited.delete(ni);
    }
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 4 + c;
      const ch = board[i].toLowerCase();
      if (TRIE[ch]) dfs(r, c, new Set([i]), ch, TRIE[ch] as TrieNode);
    }
  }

  return [...found].sort((a, b) => wordScore(b) - wordScore(a) || b.length - a.length);
}

// ─── ELO calculation ─────────────────────────────────────────────────────────
export function calcEloChange(opts: {
  playerElo: number;
  pct: number;
  mode: 'solo' | 'bot' | 'multi';
  opponentElo?: number;
  won?: boolean;
}): number {
  const K = 32;
  const { playerElo, pct, mode, opponentElo, won } = opts;

  if (mode === 'solo') {
    // Realistic expectations:
    // 1200 player expected to find ~20% of board
    // 1500 player expected to find ~30%
    // 1800 player expected to find ~40%
    const expected = Math.min(0.45, 0.10 + playerElo / 8000);
    const delta = Math.round(K * (pct - expected) * 3);
    return Math.max(-20, Math.min(40, delta));
  } else {
    const oppElo = opponentElo ?? playerElo;
    const expected = 1 / (1 + Math.pow(10, (oppElo - playerElo) / 400));
    const result = won ? 1 : 0;
    return Math.round(K * (result - expected));
  }
}


export function getRank(elo: number): { name: string; icon: string; min: number; max: number } {
  if (elo < 1000) return { name: 'Novice',      icon: '🔰', min: 0,    max: 999  };
  if (elo < 1200) return { name: 'Scholar',     icon: '📚', min: 1000, max: 1199 };
  if (elo < 1500) return { name: 'Wordsmith',   icon: '✍️', min: 1200, max: 1499 };
  if (elo < 1800) return { name: 'Lexicon',     icon: '📖', min: 1500, max: 1799 };
  return               { name: 'Grandmaster', icon: '👑', min: 1800, max: 9999 };
}
