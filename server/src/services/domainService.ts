import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import getPrismaClient from '../db/prismaConnection';
import env from '../config/variables';
import { publicStorageUrl } from './storage.service';
import {
    getPythonAnalyticsDashboard,
    getPythonRecommendations,
    getPythonRevenueBreakdown,
    getPythonTrending
} from './python.service';

const prisma: PrismaClient = getPrismaClient();

export const generateUUID = (): string => uuidv4();

const normalizeUser = (user: any) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

const normalizeGame = (game: any, stats?: { rating: number; totalRatings: number; views: number; downloads: number }) => ({
    id: game.id,
    title: game.title,
    description: game.description,
    category: game.category,
    imageUrl: publicStorageUrl(game.imageUrl) ?? game.imageUrl,
    gameUrl: game.gameUrl,
    published: game.published,
    publishedBy: game.publishedBy,
    publishedAt: game.publishedAt,
    price: game.price,
    tags: game.tags,
    rating: stats?.rating ?? 0,
    totalRatings: stats?.totalRatings ?? 0,
    views: stats?.views ?? 0,
    downloads: stats?.downloads ?? 0,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt
});

// ==================== User Operations ====================
export const createUser = async (data: {
    username: string;
    email: string;
    password: string;
    role?: string;
}) => {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
        data: {
            username: data.username,
            email: data.email,
            password: hashedPassword,
            role: data.role || 'user'
        }
    });
    return normalizeUser(user);
};

export const getUserByUUID = async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? normalizeUser(user) : null;
};

export const getUserByEmail = async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    return user
        ? {
            ...normalizeUser(user),
            password: user.password
        }
        : null;
};

export const getAllUsers = async () => {
    const users = await prisma.user.findMany();
    return users.map(normalizeUser);
};

export const updateUser = async (
    id: string,
    data: Partial<{ username: string; email: string; password: string; role: string }>
) => {
    const updateData: any = { ...data };
    if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
    }
    const user = await prisma.user.update({ where: { id }, data: updateData });
    return normalizeUser(user);
};

export const deleteUser = async (id: string) => {
    await prisma.user.delete({ where: { id } });
    return { success: true };
};

// ==================== Game Operations ====================
export const createGame = async (data: {
    title: string;
    description: string;
    category: string;
    imageUrl: string;
    gameUrl: string;
    publishedBy: string;
    price?: number;
    tags?: string[];
}) => {
    const game = await prisma.game.create({
        data: {
            title: data.title,
            description: data.description,
            category: data.category,
            imageUrl: data.imageUrl,
            gameUrl: data.gameUrl,
            publishedBy: data.publishedBy,
            price: data.price || 0,
            tags: data.tags || []
        }
    });

    return normalizeGame(game);
};

const getGameStats = async (gameId: string) => {
    const [ratings, analytics] = await Promise.all([
        prisma.rating.findMany({ where: { gameId } }),
        prisma.analytics.findMany({ where: { gameId } })
    ]);
    const totalRatings = ratings.length;
    const rating = totalRatings > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings : 0;
    const views = analytics.filter((a) => a.eventType === 'view').length;
    const downloads = analytics.filter((a) => a.eventType === 'download').length;
    return { rating, totalRatings, views, downloads };
};

export const getGameByUUID = async (id: string) => {
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return null;
    const stats = await getGameStats(id);
    return normalizeGame(game, stats);
};

export const getAllGames = async (filters?: { published?: boolean; category?: string }) => {
    const where: any = {};
    if (filters?.published !== undefined) where.published = filters.published;
    if (filters?.category) where.category = filters.category;

    const [games, ratings, analytics] = await Promise.all([
        prisma.game.findMany({ where }),
        prisma.rating.findMany({}),
        prisma.analytics.findMany({})
    ]);

    const ratingsByGame = new Map<string, number[]>();
    ratings.forEach((r) => {
        const arr = ratingsByGame.get(r.gameId) || [];
        arr.push(r.rating);
        ratingsByGame.set(r.gameId, arr);
    });

    const analyticsByGame = new Map<string, string[]>();
    analytics.forEach((a) => {
        const arr = analyticsByGame.get(a.gameId) || [];
        arr.push(a.eventType);
        analyticsByGame.set(a.gameId, arr);
    });

    return games.map((game) => {
        const gameRatings = ratingsByGame.get(game.id) || [];
        const events = analyticsByGame.get(game.id) || [];
        const stats = {
            rating: gameRatings.length ? gameRatings.reduce((sum, r) => sum + r, 0) / gameRatings.length : 0,
            totalRatings: gameRatings.length,
            views: events.filter((e) => e === 'view').length,
            downloads: events.filter((e) => e === 'download').length
        };
        return normalizeGame(game, stats);
    });
};

export const updateGame = async (
    id: string,
    data: Partial<{
        title: string;
        description: string;
        category: string;
        imageUrl: string;
        gameUrl: string;
        published: boolean;
        publishedAt: Date;
        price: number;
        tags: string[];
    }>
) => {
    const cleanData: any = {};
    Object.keys(data).forEach((key) => {
        const value = data[key as keyof typeof data];
        if (value !== undefined) cleanData[key] = value;
    });
    await prisma.game.update({ where: { id }, data: cleanData });
    return getGameByUUID(id);
};

export const deleteGame = async (id: string) => {
    await prisma.game.delete({ where: { id } });
    return { success: true };
};

// ==================== Purchase Operations ====================
export const createPurchase = async (data: {
    userId: string;
    gameId: string;
    amount: number;
    currency?: string;
    transactionId: string;
    paymentMethod?: string;
    status?: string;
}) => {
    const purchase = await prisma.purchase.create({
        data: {
            userId: data.userId,
            gameId: data.gameId,
            amount: data.amount,
            currency: data.currency || 'EUR',
            transactionId: data.transactionId,
            paymentMethod: data.paymentMethod || 'card',
            status: data.status || 'completed'
        }
    });
    return purchase;
};

export const getAllPurchases = async (filters?: { userId?: string; gameId?: string }) => {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.gameId) where.gameId = filters.gameId;
    return prisma.purchase.findMany({ where });
};

export const deletePurchase = async (id: string) => {
    await prisma.purchase.delete({ where: { id } });
    return { success: true };
};

// ==================== Rating Operations ====================
export const createRating = async (data: { userId: string; gameId: string; rating: number; review?: string }) => {
    const existingRating = await prisma.rating.findFirst({
        where: { userId: data.userId, gameId: data.gameId }
    });
    if (existingRating) throw new Error('You have already written a review for this game');

    const rating = await prisma.rating.create({
        data: {
            userId: data.userId,
            gameId: data.gameId,
            rating: data.rating,
            review: data.review
        },
        include: {
            user: {
                select: { id: true, username: true, email: true }
            }
        }
    });
    return rating;
};

export const getRatingsByGame = async (gameId: string) => {
    return prisma.rating.findMany({
        where: { gameId },
        include: {
            user: {
                select: { id: true, username: true, email: true }
            }
        }
    });
};

export const deleteRating = async (id: string) => {
    await prisma.rating.delete({ where: { id } });
    return { success: true };
};

// ==================== Ad Operations ====================
const mapAd = (ad: any) => ({
    ...ad,
    imageUrl: publicStorageUrl(ad.imageUrl) ?? ad.imageUrl
});

export const createAd = async (data: {
    title: string;
    description?: string;
    imageUrl: string;
    linkUrl: string;
    position: string;
    createdBy: string;
}) => {
    const ad = await prisma.ad.create({
        data: {
            title: data.title,
            description: data.description,
            imageUrl: data.imageUrl,
            linkUrl: data.linkUrl,
            position: data.position,
            createdBy: data.createdBy
        }
    });
    return mapAd(ad);
};

export const getAllAds = async (filters?: { active?: boolean }) => {
    const where: any = {};
    if (filters?.active !== undefined) where.active = filters.active;
    const ads = await prisma.ad.findMany({ where });
    return ads.map(mapAd);
};

export const deleteAd = async (id: string) => {
    await prisma.ad.delete({ where: { id } });
    return { success: true };
};

export const updateAd = async (
    id: string,
    data: Partial<{ title: string; description: string; active: boolean; linkUrl: string; position: string; imageUrl: string }>
) => {
    const ad = await prisma.ad.update({ where: { id }, data });
    return mapAd(ad);
};

export const trackAdClick = async (id: string) => {
    await prisma.ad.update({ where: { id }, data: { clicks: { increment: 1 } } });
    return { success: true };
};

// ==================== Analytics Operations ====================
export const createAnalytics = async (data: {
    gameId: string;
    eventType: 'view' | 'download' | 'play' | 'rating' | 'share';
    userId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}) => {
    return prisma.analytics.create({
        data: {
            gameId: data.gameId,
            eventType: data.eventType,
            userId: data.userId,
            metadata: data.metadata || {},
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            timestamp: new Date()
        }
    });
};

export const getAnalyticsByGame = async (gameId: string) => {
    return prisma.analytics.findMany({
        where: { gameId },
        orderBy: { timestamp: 'desc' }
    });
};

export const deleteAnalytics = async (id: string) => {
    await prisma.analytics.delete({ where: { id } });
    return { success: true };
};

// ==================== Session Operations ====================
export const createSession = async (data: {
    userId: string;
    sessionToken: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
}) => prisma.session.create({ data });

export const getSessionByToken = async (sessionToken: string) =>
    prisma.session.findUnique({ where: { sessionToken } });

export const getAllSessions = async (filters?: { userId?: string }) => {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    return prisma.session.findMany({ where, orderBy: { createdAt: 'desc' } });
};

export const deleteSession = async (id: string) => {
    await prisma.session.delete({ where: { id } });
    return { success: true };
};

// ==================== Join Helpers ====================
export const getGameWithPublisher = async (gameId: string) => {
    const game = await getGameByUUID(gameId);
    if (!game) return null;
    const publisher = await getUserByUUID(game.publishedBy);
    return { ...game, publisher };
};

export const getPurchaseWithDetails = async (purchaseId: string) => {
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return null;
    const [user, game] = await Promise.all([getUserByUUID(purchase.userId), getGameByUUID(purchase.gameId)]);
    return { ...purchase, user, game };
};

export const getAnalyticsWithGame = async (analyticsId: string) => {
    const analytics = await prisma.analytics.findUnique({ where: { id: analyticsId } });
    if (!analytics) return null;
    const game = await getGameByUUID(analytics.gameId);
    return { ...analytics, game };
};

// ==================== Authentication ====================
export const login = async (email: string, password: string, ipAddress?: string, userAgent?: string) => {
    const user = await getUserByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error('Invalid credentials');
    if (!env.JWT_SECRET) throw new Error('JWT_SECRET not configured');

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
        await createSession({
            userId: user.id,
            sessionToken: token,
            ipAddress,
            userAgent,
            expiresAt
        });
    } catch (error: any) {
        console.error('Failed to create session:', error.message);
    }

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    };
};

export const getRecommendations = async (userId: string) => {
    try {
        return await getPythonRecommendations(userId);
    } catch {
        // Fallback to top downloaded games when recommender is unavailable.
        const games = await getAllGames({ published: true });
        return {
            userId,
            source: 'fallback',
            recommendations: games
                .sort((a, b) => b.downloads - a.downloads)
                .slice(0, 10)
                .map((game) => ({
                    gameId: game.id,
                    score: game.downloads + game.views * 0.1,
                    reason: 'Top performing game'
                }))
        };
    }
};

export const getTrendingAnalytics = async () => getPythonTrending();

// ==================== Analytics Dashboard (Python service only) ====================
export const getAnalyticsDashboard = async () => {
    const data = (await getPythonAnalyticsDashboard()) as Record<string, unknown>;
    const { source: _src, ...rest } = data;
    void _src;
    return rest;
};

export const getRevenueBreakdown = async () => {
    const data = (await getPythonRevenueBreakdown()) as Record<string, unknown>;
    const { source: _src, ...rest } = data;
    void _src;
    return rest;
};
