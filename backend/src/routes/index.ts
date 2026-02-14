import express from 'express';
import { signup, login } from '../controllers/authController';
import { completeProfile, getProfile, uploadPhoto, updateUserBasics, deletePhoto, setPrimaryPhoto, reorderPhoto, activateBoost, deleteAccount } from '../controllers/profileController';
import { searchMatches, refreshOffGrid, getUserDetails, unmatch } from '../controllers/matchController';
import { likeProfile, getLikesRemaining, getMatches, getIncomingLikes, sendCompliment } from '../controllers/likeController';
import { authenticate } from '../middleware/auth';
import {
  requestOtp,
  verifyOtp,
  verifyLocation,
  getVerificationStatus,
  verifySelfieAge,
  publicGeocode,
} from '../controllers/verificationController';
import { registerToken, unregisterToken } from '../controllers/pushController';
import { sendMessage, getMessages, getConversations, markAsRead, deleteMessage } from '../controllers/messageController';
import { sidekick } from '../controllers/aiController';
import { getWalletSummary, purchasePlan } from '../controllers/walletController';
import { createReport } from '../controllers/reportController';
import {
  getPrivacySettings,
  updatePrivacySettings,
  getBlockedUsers,
  blockUser,
  unblockUser,
} from '../controllers/privacyController';
import { getNotificationPreferences, updateNotificationPreferences } from '../controllers/notificationsController';
import { getMediaCapabilities, getUploadSignature } from '../controllers/mediaController';

const router = express.Router();

// Public routes
router.post('/geocode', publicGeocode);

// Auth routes
router.post('/auth/signup', signup);
router.post('/auth/login', login);

// Profile routes (protected)
router.post('/profile/complete', authenticate, completeProfile);
router.get('/profile/me', authenticate, getProfile);
router.post('/profile/photo', authenticate, uploadPhoto);
router.delete('/profile/photo/:photoId', authenticate, deletePhoto);
router.post('/profile/photo/primary', authenticate, setPrimaryPhoto);
router.post('/profile/photo/reorder', authenticate, reorderPhoto);
router.post('/profile/basic', authenticate, updateUserBasics);
router.post('/profile/boost', authenticate, activateBoost);
router.delete('/profile/me', authenticate, deleteAccount);

// Match routes (protected)
router.post('/matches/search', authenticate, searchMatches);
router.post('/matches/refresh-off-grid', authenticate, refreshOffGrid);
router.get('/matches/user/:targetUserId', authenticate, getUserDetails);
router.post('/matches/:matchId/unmatch', authenticate, unmatch);

// Like routes (protected)
router.post('/likes', authenticate, likeProfile);
router.post('/likes/compliment', authenticate, sendCompliment);
router.get('/likes/remaining', authenticate, getLikesRemaining);
router.get('/likes/incoming', authenticate, getIncomingLikes);
router.get('/matches', authenticate, getMatches);
router.get('/wallet/summary', authenticate, getWalletSummary);
router.post('/wallet/purchase', authenticate, purchasePlan);
router.post('/report', authenticate, createReport);

// Privacy and safety routes
router.get('/privacy/settings', authenticate, getPrivacySettings);
router.post('/privacy/settings', authenticate, updatePrivacySettings);
router.get('/privacy/blocked', authenticate, getBlockedUsers);
router.post('/privacy/block', authenticate, blockUser);
router.post('/privacy/unblock', authenticate, unblockUser);

// Notification preferences routes
router.get('/notifications/preferences', authenticate, getNotificationPreferences);
router.post('/notifications/preferences', authenticate, updateNotificationPreferences);

// Media routes
router.get('/media/capabilities', authenticate, getMediaCapabilities);
router.post('/media/upload-signature', authenticate, getUploadSignature);

// Verification routes
router.post('/verification/otp/request', authenticate, requestOtp);
router.post('/verification/otp/verify', authenticate, verifyOtp);
router.post('/verification/selfie', authenticate, verifySelfieAge);
router.post('/verification/location', authenticate, verifyLocation);
router.get('/verification/status', authenticate, getVerificationStatus);

// Push notification routes
router.post('/push/register', authenticate, registerToken);
router.post('/push/unregister', authenticate, unregisterToken);

// Message routes (protected)
router.post('/messages', authenticate, sendMessage);
router.get('/messages/:matchId', authenticate, getMessages);
router.get('/conversations', authenticate, getConversations);
router.post('/messages/:matchId/read', authenticate, markAsRead);
router.delete('/messages/:messageId', authenticate, deleteMessage);

// AI routes (protected)
router.post('/ai/sidekick', authenticate, sidekick);

export default router;
