import { Router } from 'express';
import callRoutes from './callRoutes';
import vapiRoutes from './vapiRoutes';
import anomalyRoutes from '../anomaly/anomalyController';

const router = Router();

// Mount route handlers
router.use('/api', callRoutes);
router.use('/api/vapi', vapiRoutes);
router.use('/api', anomalyRoutes);

export default router;
