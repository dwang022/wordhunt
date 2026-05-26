const BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    credentials: 'include',
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  signup: (email: string, password: string, username: string) =>
    req<{ user: any; session: any }>('/auth/signup', {
      method: 'POST', body: JSON.stringify({ email, password, username })
    }),
  signin: (email: string, password: string) =>
    req<{ user: any; session: any }>('/auth/signin', {
      method: 'POST', body: JSON.stringify({ email, password })
    }),
  guest: () => req<{ user: any; session: any }>('/auth/anonymous', { method: 'POST' }),
  getProfile: (userId: string) => req<any>(`/profile/${userId}`),
  updateUsername: (userId: string, username: string) =>
    req<any>(`/profile/${userId}`, { method: 'PATCH', body: JSON.stringify({ username }) }),
  getLeaderboard: () => req<any[]>('/leaderboard'),
  getGames: (userId: string) => req<any[]>(`/games/${userId}`),
};
