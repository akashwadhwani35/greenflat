import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Server } from 'http';
import routes from './routes';
import pool from './config/database';
import { isCloudinaryConfigured } from './services/media.service';
import { isSmsConfigured } from './services/sms.service';

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

let server: Server | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export { server };
export default app;
