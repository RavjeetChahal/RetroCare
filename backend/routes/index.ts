import { Router } from 'express';
import callRoutes from './callRoutes';
import vapiRoutes from './vapiRoutes';
import anomalyRoutes from '../anomaly/anomalyController';
import diagnosticsRoutes from './diagnostics';

const router = Router();

// Mount route handlers
// Note: These routes are already prefixed with /api in server.ts
router.use(callRoutes);
router.use('/vapi', vapiRoutes);
router.use(anomalyRoutes);
router.use('/diagnostics', diagnosticsRoutes);

export default router;
