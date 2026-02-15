import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { getStats, getReports, updateReport, getUsers, toggleBan } from '../controllers/adminController';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.patch('/reports/:reportId', updateReport);
router.get('/users', getUsers);
router.post('/users/:userId/ban', toggleBan);

export default router;
