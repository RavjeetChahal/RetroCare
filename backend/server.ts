import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';
import routes from './routes';
import { startScheduler } from './scheduler';

// Load environment variables
// Tries backend/.env first, then falls back to root .env
// In production (deployed), environment variables are set by the platform
if (process.env.NODE_ENV !== 'production') {
  // Try backend/.env first (for backward compatibility)
  const backendEnvPath = path.resolve(process.cwd(), 'backend', '.env');
  const rootEnvPath = path.resolve(process.cwd(), '.env');
  
  let result = dotenv.config({ path: backendEnvPath });
  
  // If backend/.env doesn't exist, try root .env
  if (result.error) {
    result = dotenv.config({ path: rootEnvPath });
    if (result.error) {
      console.error(`[RetroCare] Failed to load .env from ${backendEnvPath} or ${rootEnvPath}`);
    } else {
      console.log(`[RetroCare] Loaded environment from: ${rootEnvPath}`);
    }
  } else {
    console.log(`[RetroCare] Loaded environment from: ${backendEnvPath}`);
  }
} else {
  console.log('[RetroCare] Running in production - using platform environment variables');
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

// API routes (must come before static file serving)
app.use(routes);

// Serve static frontend files (if dist folder exists from Expo export)
const frontendPath = path.resolve(process.cwd(), 'dist');
const frontendExists = fs.existsSync(frontendPath);

if (frontendExists) {
  logger.info(`Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // Fallback to index.html for client-side routing (SPA)
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  logger.info('Frontend dist folder not found - serving API only');
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`RetroCare server running on port ${PORT}`);
  if (frontendExists) {
    logger.info('✓ Frontend is being served');
  }
  logger.info('✓ API routes available at /api/*');
  
  // Start the call scheduler
  startScheduler();
});

export default app;

