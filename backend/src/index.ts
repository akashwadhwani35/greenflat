import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer, type Server } from 'http';
import path from 'path';
import routes from './routes';
import pool from './config/database';
import { isCloudinaryConfigured } from './services/media.service';
import { isSmsConfigured } from './services/sms.service';
import { initSocketServer } from './socket';
import { runMigrations } from './database/migrate';
import { isPaymentsEnabled } from './services/payments.service';
import { initRevenueCat } from './services/revenuecat.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const assertProductionReadiness = () => {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.REQUIRE_EXTERNAL_SERVICES === 'false') return;

  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!isSmsConfigured()) missing.push('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER');
  if (!isCloudinaryConfigured()) missing.push('CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    throw new Error(`Missing production service configuration: ${missing.join(', ')}`);
  }
};

assertProductionReadiness();

// Registers the receipt validator when a RevenueCat key is present. Without it
// isPaymentsEnabled() stays false and purchase endpoints return 501.
initRevenueCat();

// CORS configuration
const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : null;

// Security headers
app.use(helmet());

app.use(
  cors(
    corsAllowedOrigins
      ? { origin: corsAllowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }
      : undefined
  )
);

// Body size limits
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Local media files (dev/local fallback when Cloudinary is not configured)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Dating App API is running' });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const httpServer = createServer(app);
let server: Server | null = null;

const startServer = () => {
  initSocketServer(httpServer);
  server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💳 Payments: ${isPaymentsEnabled() ? 'ENABLED' : 'disabled (purchase endpoints return 501)'}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  // Pending migrations are applied before we accept traffic. The runner takes a
  // Postgres advisory lock, so several Cloud Run instances booting at once is safe.
  // Set RUN_MIGRATIONS_ON_BOOT=false to manage migrations as a separate deploy step.
  if (process.env.RUN_MIGRATIONS_ON_BOOT === 'false') {
    startServer();
  } else {
    console.log('🗂  Checking for pending migrations...');
    runMigrations()
      .then(({ applied, skipped }) => {
        console.log(
          applied.length === 0
            ? `🗂  Migrations up to date (${skipped} already applied).`
            : `🗂  Applied ${applied.length} migration(s).`
        );
        startServer();
      })
      .catch((error) => {
        console.error('❌ Migrations failed, refusing to start:', error);
        process.exit(1);
      });
  }
}

export { server, corsAllowedOrigins };
export default app;
