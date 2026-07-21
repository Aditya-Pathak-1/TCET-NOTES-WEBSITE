import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads statically (useful for direct URL access + future CDN swap)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API ───────────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  LMS Server  →  http://localhost:${PORT}`);
  console.log(`📁  Uploads     →  ${path.join(__dirname, '../uploads')}`);
  console.log(`✅  Health      →  http://localhost:${PORT}/health\n`);
});
