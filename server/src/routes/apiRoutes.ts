import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from '../controllers/apiController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = Router();

// ==================== Auth Routes ====================
router.post(
    '/auth/register',
    [
        body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    controller.register
);

router.post(
    '/auth/login',
    [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    controller.login
);

router.get('/auth/me', authenticate, controller.getMe);

// ==================== User Routes ====================
router.post('/users', authenticate, isAdmin, controller.createUser);
router.get('/users', authenticate, isAdmin, controller.getAllUsers);
router.get('/users/:id', authenticate, isAdmin, controller.getUser);
router.patch('/users/:id', authenticate, isAdmin, controller.updateUser);
router.delete('/users/:id', authenticate, isAdmin, controller.deleteUser);

// ==================== Game Routes ====================
router.post(
    '/games',
    authenticate,
    isAdmin,
    upload.single('image'),
    controller.createGame
);
router.get('/games', controller.getAllGames);
router.get('/games/:id', controller.getGame);
router.get('/games/:id/image', controller.getGameImage);
router.get('/games/:id/with-publisher', controller.getGameWithPublisher);
router.get('/games/:id/rating/check', authenticate, controller.checkRating);
router.get('/games/:id/reviews', controller.getRatingsByGame);
router.post('/games/:id/view', controller.trackView);
router.post('/games/:id/play', controller.trackPlay);
router.post('/games/:id/download', controller.trackDownload);
router.post('/games/:id/rating', authenticate, controller.createRating);
router.patch('/games/:id/publish', authenticate, isAdmin, controller.publishGame);
router.patch(
    '/games/:id',
    authenticate,
    isAdmin,
    upload.single('image'),
    controller.updateGame
);
router.delete('/games/:id', authenticate, isAdmin, controller.deleteGame);

// ==================== Purchase Routes ====================
router.post('/purchases', authenticate, controller.createPurchase);
router.get('/purchases', authenticate, controller.getAllPurchases);
router.get('/purchases/check/:id', authenticate, controller.checkPurchase);
router.get('/purchases/:id/with-details', authenticate, controller.getPurchaseWithDetails);
router.delete('/purchases/:id', authenticate, controller.deletePurchase);

// ==================== Rating Routes ====================
router.post('/ratings', authenticate, controller.createRating);
router.get('/ratings/game/:gameId', controller.getRatingsByGame);
router.delete('/ratings/:id', authenticate, controller.deleteRating);

// ==================== Ad Routes ====================
router.post(
    '/ads',
    authenticate,
    isAdmin,
    upload.single('image'),
    controller.createAd
);
router.get('/ads', controller.getAllAds);
router.get('/ads/:id/image', controller.getAdImage);
router.patch('/ads/:id', authenticate, isAdmin, upload.single('image'), controller.updateAd);
router.post('/ads/:id/click', controller.trackAdClick);
router.delete('/ads/:id', authenticate, isAdmin, controller.deleteAd);

// ==================== Analytics Routes ====================
router.post('/analytics', controller.createAnalytics);
router.get('/analytics/dashboard', authenticate, isAdmin, controller.getAnalyticsDashboard);
router.get('/analytics/revenue-breakdown', authenticate, isAdmin, controller.getRevenueBreakdown);
router.get('/analytics/trending', controller.getTrendingAnalytics);
router.get('/recommendations/:userId', authenticate, controller.getRecommendations);
router.get('/analytics/game/:gameId', controller.getAnalyticsByGame);
router.get('/analytics/:id/with-game', controller.getAnalyticsWithGame);
router.delete('/analytics/:id', authenticate, isAdmin, controller.deleteAnalytics);

// ==================== Session Routes ====================
router.post('/sessions', controller.createSession);
router.get('/sessions/token/:token', controller.getSession);
router.get('/sessions', authenticate, isAdmin, controller.getAllSessions);
router.delete('/sessions/:id', authenticate, isAdmin, controller.deleteSession);

export default router;
