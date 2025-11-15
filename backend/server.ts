import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { logger } from '../utils';
import routes from './routes';
import { startScheduler } from './scheduler';

// Load environment variables
config();

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

