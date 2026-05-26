import { Server, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import {
  generateBoard, findAllWords, wordScore, calcEloChange, isWord
} from './gameLogic.js';
import { getProfile, updateElo, recordGame, updateBestScore } from './db.js';

const GAME_DURATION = 80;

interface Player {
  socketId: string;
  userId: string;
  username: string;
  elo: number;
  score: number;
  foundWords: Set<string>;
  ready: boolean;
}

interface GameRoom {
  id: string;
  code: string;
  board: string[];
  allWords: string[];
  maxPossible: number;
  players: Map<string, Player>;
  startTime: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  countdown: ReturnType<typeof setInterval> | null;
  mode: 'pvp' | 'private';
  finished: boolean;
}

const matchQueue: Map<string, { socket: Socket; userId: string; username: string; elo: number }> = new Map();
const rooms: Map<string, GameRoom> = new Map();
const privateCodes: Map<string, string> = new Map();
const userRoom: Map<string, string> = new Map();

function makeCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createRoom(mode: 'pvp' | 'private'): GameRoom {
  const board = generateBoard();
  const allWords = findAllWords(board);
  const maxPossible = allWords.reduce((s, w) => s + wordScore(w), 0);
  const code = makeCode();
  const room: GameRoom = {
    id: uuid(), code, board, allWords, maxPossible,
    players: new Map(), startTime: null, timer: null, countdown: null,
    mode, finished: false
  };
  rooms.set(room.id, room);
  if (mode === 'private') privateCodes.set(code, room.id);
  return room;
}

function startGame(io: Server, room: GameRoom) {
  room.startTime = Date.now();

  io.to(room.id).emit('game:start', {
    roomId: room.id,
    board: room.board,
    allWords: room.allWords,
    maxPossible: room.maxPossible,
    duration: GAME_DURATION,
    players: [...room.players.values()].map(p => ({
      userId: p.userId, username: p.username, elo: p.elo
    }))
  });

  let timeLeft = GAME_DURATION;
  room.countdown = setInterval(() => {
    timeLeft--;
    io.to(room.id).emit('game:tick', { timeLeft });
    if (timeLeft <= 0) {
      clearInterval(room.countdown!);
      endGame(io, room);
    }
  }, 1000);
}

async function endGame(io: Server, room: GameRoom) {
  if (room.finished) return;
  room.finished = true;
  if (room.timer) clearTimeout(room.timer);
  if (room.countdown) clearInterval(room.countdown);

  const players = [...room.players.values()];

  let winner: Player | null = null;
  if (players.length === 2) {
    const [a, b] = players;
    winner = a.score > b.score ? a : b.score > a.score ? b : null;
  }

  const eloChanges: Record<string, number> = {};
  for (const p of players) {
    const pct = room.maxPossible > 0 ? p.score / room.maxPossible : 0;
    const opponent = players.find(x => x.userId !== p.userId);
    const won = winner ? winner.userId === p.userId : null;

    const delta = calcEloChange({
      playerElo: p.elo,
      pct,
      mode: 'multi',
      opponentElo: opponent?.elo,
      won: won ?? undefined,
    });
    eloChanges[p.userId] = delta;

    await updateElo(p.userId, delta, won);
    await updateBestScore(p.userId, p.score);
    await recordGame({
      player_id: p.userId,
      opponent_id: opponent?.userId,
      mode: room.mode,
      score: p.score,
      opponent_score: opponent?.score,
      max_possible: room.maxPossible,
      words_found: [...p.foundWords],
      elo_before: p.elo,
      elo_after: Math.max(100, p.elo + delta),
      board: room.board,
      won: won ?? null,
    });
  }

  const results = players.map(p => ({
    userId: p.userId,
    username: p.username,
    score: p.score,
    wordsFound: [...p.foundWords],
    eloBefore: p.elo,
    eloAfter: Math.max(100, p.elo + eloChanges[p.userId]),
    eloDelta: eloChanges[p.userId],
    won: winner ? winner.userId === p.userId : null,
    pct: room.maxPossible > 0 ? p.score / room.maxPossible : 0,
  }));

  io.to(room.id).emit('game:end', {
    results,
    allWords: room.allWords,
    maxPossible: room.maxPossible,
    board: room.board,
  });

  setTimeout(() => {
    rooms.delete(room.id);
    if (room.mode === 'private') privateCodes.delete(room.code);
    for (const p of players) userRoom.delete(p.userId);
  }, 30000);
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    let currentUserId: string | null = null;

    socket.on('user:join', async ({ userId, username }: { userId: string; username: string }) => {
      currentUserId = userId;

      const existingRoomId = userRoom.get(userId);
      if (existingRoomId) {
        const room = rooms.get(existingRoomId);
        if (room && !room.finished) {
          const player = room.players.get(userId);
          if (player) {
            player.socketId = socket.id;
            socket.join(existingRoomId);
            socket.emit('game:reconnect', {
              roomId: room.id,
              board: room.board,
              allWords: room.allWords,
              maxPossible: room.maxPossible,
              timeLeft: room.startTime
                ? Math.max(0, GAME_DURATION - Math.floor((Date.now() - room.startTime) / 1000))
                : GAME_DURATION,
              score: player.score,
              foundWords: [...player.foundWords],
            });
          }
        }
      }
    });

    socket.on('match:queue', async ({ userId, username }: { userId: string; username: string }) => {
      const profile = await getProfile(userId);
      const elo = profile?.elo ?? 1200;

      if (matchQueue.has(userId)) return;
      matchQueue.set(userId, { socket, userId, username, elo });
      socket.emit('match:queued');

      const ELO_WINDOW = 200;
      let bestMatch: any = null;
      let bestDiff = Infinity;

      for (const [uid, entry] of matchQueue) {
        if (uid === userId) continue;
        const diff = Math.abs(entry.elo - elo);
        if (diff < ELO_WINDOW && diff < bestDiff) {
          bestDiff = diff;
          bestMatch = entry;
        }
      }

      if (bestMatch) {
        matchQueue.delete(userId);
        matchQueue.delete(bestMatch.userId);

        const room = createRoom('pvp');
        const addPlayer = (entry: any, sk: Socket) => {
          const p: Player = {
            socketId: sk.id, userId: entry.userId, username: entry.username,
            elo: entry.elo, score: 0, foundWords: new Set(), ready: false
          };
          room.players.set(entry.userId, p);
          userRoom.set(entry.userId, room.id);
          sk.join(room.id);
        };
        addPlayer({ socket, userId, username, elo }, socket);
        addPlayer(bestMatch, bestMatch.socket);

        io.to(room.id).emit('match:found', { roomId: room.id });
        startGame(io, room);
      }
    });

    socket.on('match:dequeue', ({ userId }: { userId: string }) => {
      matchQueue.delete(userId);
      socket.emit('match:dequeued');
    });

    socket.on('solo:start', async ({ userId, username }: { userId: string; username: string }) => {
      const profile = await getProfile(userId);
      const elo = profile?.elo ?? 1200;

      const room = createRoom('pvp');
      const player: Player = {
        socketId: socket.id, userId, username, elo,
        score: 0, foundWords: new Set(), ready: true
      };
      room.players.set(userId, player);
      userRoom.set(userId, room.id);
      socket.join(room.id);

      // Send roomId so client can submit words correctly
      socket.emit('game:start', {
        roomId: room.id,
        board: room.board,
        allWords: room.allWords,
        maxPossible: room.maxPossible,
        duration: GAME_DURATION,
        solo: true,
        players: [{ userId, username, elo }]
      });

      let timeLeft = GAME_DURATION;
      room.startTime = Date.now();
      room.countdown = setInterval(async () => {
        timeLeft--;
        socket.emit('game:tick', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(room.countdown!);

          const pct = room.maxPossible > 0 ? player.score / room.maxPossible : 0;
          const delta = calcEloChange({ playerElo: elo, pct, mode: 'solo' });
          const newElo = Math.max(100, elo + delta);

          await updateElo(userId, delta, null);
          await updateBestScore(userId, player.score);
          await recordGame({
            player_id: userId, mode: 'solo', score: player.score,
            max_possible: room.maxPossible, words_found: [...player.foundWords],
            elo_before: elo, elo_after: newElo, board: room.board, won: null
          });

          socket.emit('game:end', {
            results: [{
              userId, username, score: player.score,
              wordsFound: [...player.foundWords],
              eloBefore: elo, eloAfter: newElo, eloDelta: delta,
              won: null, pct
            }],
            allWords: room.allWords,
            maxPossible: room.maxPossible,
            board: room.board,
          });

          rooms.delete(room.id);
          userRoom.delete(userId);
        }
      }, 1000);
    });

    socket.on('private:create', async ({ userId, username }: { userId: string; username: string }) => {
      const profile = await getProfile(userId);
      const elo = profile?.elo ?? 1200;
      const room = createRoom('private');
      const player: Player = {
        socketId: socket.id, userId, username, elo,
        score: 0, foundWords: new Set(), ready: false
      };
      room.players.set(userId, player);
      userRoom.set(userId, room.id);
      socket.join(room.id);
      socket.emit('private:created', { code: room.code, roomId: room.id });
    });

    socket.on('private:join', async ({ userId, username, code }: { userId: string; username: string; code: string }) => {
      const roomId = privateCodes.get(code.toUpperCase());
      if (!roomId) { socket.emit('private:error', { message: 'Room not found' }); return; }
      const room = rooms.get(roomId);
      if (!room || room.finished) { socket.emit('private:error', { message: 'Room expired' }); return; }
      if (room.players.size >= 2) { socket.emit('private:error', { message: 'Room full' }); return; }

      const profile = await getProfile(userId);
      const elo = profile?.elo ?? 1200;
      const player: Player = {
        socketId: socket.id, userId, username, elo,
        score: 0, foundWords: new Set(), ready: false
      };
      room.players.set(userId, player);
      userRoom.set(userId, roomId);
      socket.join(roomId);

      io.to(roomId).emit('private:playerJoined', {
        username, elo,
        players: [...room.players.values()].map(p => ({ userId: p.userId, username: p.username, elo: p.elo }))
      });

      if (room.players.size === 2) {
        startGame(io, room);
      }
    });

    socket.on('word:submit', ({ userId, word, roomId }: { userId: string; word: string; roomId: string }) => {
      const room = rooms.get(roomId);
      if (!room || room.finished || !room.startTime) return;
      const player = room.players.get(userId);
      if (!player) return;

      const w = word.toLowerCase().trim();
      if (w.length < 3) return;
      if (player.foundWords.has(w)) {
        socket.emit('word:result', { word: w, status: 'already', score: 0, total: player.score });
        return;
      }
      if (!isWord(w)) {
        socket.emit('word:result', { word: w, status: 'invalid', score: 0, total: player.score });
        return;
      }

      const pts = wordScore(w);
      player.foundWords.add(w);
      player.score += pts;

      socket.emit('word:result', { word: w, status: 'valid', score: pts, total: player.score });
      socket.to(roomId).emit('opponent:score', { score: player.score, wordCount: player.foundWords.size });
    });

    socket.on('disconnect', () => {
      if (!currentUserId) return;
      matchQueue.delete(currentUserId);

      const roomId = userRoom.get(currentUserId);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && !room.finished) {
          socket.to(roomId).emit('opponent:disconnected');
          room.timer = setTimeout(() => endGame(io, room), 30000);
        }
      }
    });
  });
}
