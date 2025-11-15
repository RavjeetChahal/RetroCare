/**
 * Server configuration for serving both frontend and backend together
 * Use this if you want to deploy frontend and backend on the same service
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
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

// Validate critical environment variables
const requiredEnvVars = ['ELEVENLABS_API_KEY', 'VAPI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  logger.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.warn('Make sure backend/.env file exists and contains all required keys');
} else {
  logger.info('✓ All required environment variables loaded');
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
app.use('/api', routes);

// Serve static frontend files (if dist folder exists)
const frontendPath = path.resolve(process.cwd(), 'dist');
const frontendExists = require('fs').existsSync(frontendPath);

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
  logger.warn(`Frontend dist folder not found at ${frontendPath}`);
  logger.warn('Frontend will not be served. Make sure to run: npx expo export --platform web');
  
  // Fallback route for when frontend isn't built
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.status(404).json({ 
        error: 'Frontend not built. Run: npx expo export --platform web',
        path: req.path 
      });
    }
  });
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

