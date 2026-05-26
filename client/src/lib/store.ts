import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  win_streak: number;
  best_score: number;
  total_games: number;
}

export interface GameResult {
  userId: string;
  username: string;
  score: number;
  wordsFound: string[];
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  won: boolean | null;
  pct: number;
}

interface AppState {
  // Auth
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  accessToken: string | null;

  // Game
  gameMode: 'solo' | 'pvp' | 'private' | null;
  roomId: string | null;
  lastResult: {
    results: GameResult[];
    allWords: string[];
    maxPossible: number;
    board: string[];
  } | null;

  // Actions
  setUser: (user: AppState['user'], token: string | null) => void;
  setProfile: (profile: UserProfile) => void;
  updateProfileElo: (newElo: number, delta: number, won: boolean | null) => void;
  setGameMode: (mode: AppState['gameMode']) => void;
  setRoomId: (id: string | null) => void;
  setLastResult: (r: AppState['lastResult']) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      accessToken: null,
      gameMode: null,
      roomId: null,
      lastResult: null,

      setUser: (user, token) => set({ user, accessToken: token }),
      setProfile: (profile) => set({ profile }),
      updateProfileElo: (newElo, delta, won) =>
        set((s) => {
          if (!s.profile) return s;
          return {
            profile: {
              ...s.profile,
              elo: newElo,
              wins: won === true ? s.profile.wins + 1 : s.profile.wins,
              losses: won === false ? s.profile.losses + 1 : s.profile.losses,
              win_streak: won === true ? s.profile.win_streak + 1 : won === false ? 0 : s.profile.win_streak,
              total_games: s.profile.total_games + 1,
            }
          };
        }),
      setGameMode: (mode) => set({ gameMode: mode }),
      setRoomId: (id) => set({ roomId: id }),
      setLastResult: (r) => set({ lastResult: r }),
      logout: () => set({ user: null, profile: null, accessToken: null, gameMode: null, roomId: null }),
    }),
    {
      name: 'wordhunt-store',
      partialize: (s) => ({ user: s.user, profile: s.profile, accessToken: s.accessToken }),
    }
  )
);
