import { Router } from 'express';
import callRoutes from './callRoutes';

const router = Router();

// Mount route handlers
router.use('/api', callRoutes);

export default router;
