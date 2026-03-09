import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import {
  getStats, getReports, updateReport, getUsers, toggleBan,
  getRevenueAnalytics, getTokenAnalytics, getEngagementAnalytics, getGrowthAnalytics,
  grantRemoveTokens, grantSubscription, toggleShadowBan,
} from '../controllers/adminController';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.patch('/reports/:reportId', updateReport);
router.get('/users', getUsers);
router.post('/users/:userId/ban', toggleBan);

// Analytics
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/tokens', getTokenAnalytics);
router.get('/analytics/engagement', getEngagementAnalytics);
router.get('/analytics/growth', getGrowthAnalytics);

// User management
router.post('/users/:userId/tokens', grantRemoveTokens);
router.post('/users/:userId/subscription', grantSubscription);
router.post('/users/:userId/shadow-ban', toggleShadowBan);

export default router;
