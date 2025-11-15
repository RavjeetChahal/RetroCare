import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import routes from './routes';
import { startScheduler } from './scheduler';

// Load environment variables from backend/.env
// This ensures backend secrets are separate from frontend .env
// Use process.cwd() to get project root, then join to backend/.env
// This works better with tsx which may have different __dirname behavior
const envPath = path.resolve(process.cwd(), 'backend', '.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error(`[RetroCare] Failed to load .env from ${envPath}:`, result.error);
} else {
  console.log(`[RetroCare] Loaded environment from: ${envPath}`);
}

// Validate critical environment variables on startup
const requiredEnvVars = ['ELEVENLABS_API_KEY', 'VAPI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  logger.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.warn('Make sure backend/.env file exists and contains all required keys');
} else {
  logger.info('✓ All required environment variables loaded from backend/.env');
  logger.info(`✓ ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY?.substring(0, 10)}...`);
  logger.info(`✓ VAPI_API_KEY: ${process.env.VAPI_API_KEY?.substring(0, 10)}...`);
  
  // VAPI_ASSISTANT_ID is optional (only used as fallback)
  if (process.env.VAPI_ASSISTANT_ID) {
    logger.info(`✓ VAPI_ASSISTANT_ID: ${process.env.VAPI_ASSISTANT_ID.substring(0, 10)}... (optional fallback)`);
  } else {
    logger.info('✓ VAPI_ASSISTANT_ID: not set (optional - each voice has its own assistant ID)');
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use(routes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`RetroCare backend server running on port ${PORT}`);
  
  // Start the call scheduler
  startScheduler();
});

export default app;

