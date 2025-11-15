import { Router } from 'express';
import callRoutes from './callRoutes';
import anomalyRoutes from '../anomaly/anomalyController';

const router = Router();

// Mount route handlers
router.use('/api', callRoutes);
router.use('/api', anomalyRoutes);

export default router;
