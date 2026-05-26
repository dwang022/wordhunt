import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(userId: string, username: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit('user:join', { userId, username });
  return s;
}
