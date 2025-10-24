import express from 'express';
import { signup, login } from '../controllers/authController';
import { completeProfile, getProfile, uploadPhoto } from '../controllers/profileController';
import { searchMatches, refreshOffGrid, getUserDetails } from '../controllers/matchController';
import { likeProfile, getLikesRemaining, getMatches } from '../controllers/likeController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Auth routes
router.post('/auth/signup', signup);
router.post('/auth/login', login);

// Profile routes (protected)
router.post('/profile/complete', authenticate, completeProfile);
router.get('/profile/me', authenticate, getProfile);
router.post('/profile/photo', authenticate, uploadPhoto);

// Match routes (protected)
router.post('/matches/search', authenticate, searchMatches);
router.post('/matches/refresh-off-grid', authenticate, refreshOffGrid);
router.get('/matches/user/:targetUserId', authenticate, getUserDetails);

// Like routes (protected)
router.post('/likes', authenticate, likeProfile);
router.get('/likes/remaining', authenticate, getLikesRemaining);
router.get('/matches', authenticate, getMatches);

export default router;
