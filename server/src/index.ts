import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return cb(null, true);
      // Allow any vercel.app subdomain or configured origin
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
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
