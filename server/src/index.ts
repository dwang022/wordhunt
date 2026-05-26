import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes.js';
import { registerSocketHandlers } from './socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:4173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json());
app.use('/api', routes);

app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

registerSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, () => {
  console.log(`\n🔤  Word Hunt Server`);
  console.log(`   HTTP  → http://localhost:${PORT}`);
  console.log(`   WS    → ws://localhost:${PORT}`);
  console.log(`   Env   → ${process.env.SUPABASE_URL ? 'Supabase connected' : 'No Supabase (local only)'}\n`);
});
