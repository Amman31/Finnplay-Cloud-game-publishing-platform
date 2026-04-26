import { Request, Response } from 'express';
import * as domainService from '../services/domainService';
import { deleteImageByUrl, uploadImageBuffer } from '../services/storage.service';

// ==================== User Controllers ====================
export const createUser = async (req: Request, res: Response) => {
    try {
        const user = await domainService.createUser(req.body);
        res.status(201).json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await domainService.getAllUsers();
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getUser = async (req: Request, res: Response) => {
    try {
        const user = await domainService.getUserByUUID(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await domainService.updateUser(req.params.id, req.body);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        await domainService.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Game Controllers ====================
export const createGame = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Extract fields from multipart/form-data
        const { title, description, category, gameUrl, price, tags } = req.body;
        
        if (!title || !description || !category || !gameUrl) {
            return res.status(400).json({ error: 'Missing required fields: title, description, category, gameUrl' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // Parse tags if provided
        let parsedTags: string[] = [];
        if (tags) {
            try {
                parsedTags = JSON.parse(tags);
            } catch {
                // If not JSON, treat as comma-separated string
                parsedTags = tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
            }
        }

        const game = await domainService.createGame({
            title,
            description,
            category,
            gameUrl,
            price: price ? parseFloat(price) : 0,
            tags: parsedTags,
            imageUrl: await uploadImageBuffer(req.file.buffer, req.file.mimetype, 'games'),
            publishedBy: userId
        });
        res.status(201).json(game);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllGames = async (req: Request, res: Response) => {
    try {
        const games = await domainService.getAllGames({
            published: req.query.published === 'true' ? true : req.query.published === 'false' ? false : undefined,
            category: req.query.category as string
        });
        res.json({ games }); // Frontend expects { games: [...] }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getGame = async (req: Request, res: Response) => {
    try {
        const game = await domainService.getGameByUUID(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({ game }); // Frontend expects { game: {...} }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getGameImage = async (req: Request, res: Response) => {
    try {
        const game = await domainService.getGameByUUID(req.params.id);
        if (!game || !game.imageUrl) {
            return res.status(404).json({ error: 'Game image not found' });
        }
        res.redirect(game.imageUrl);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getGameWithPublisher = async (req: Request, res: Response) => {
    try {
        const game = await domainService.getGameWithPublisher(req.params.id);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(game);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateGame = async (req: Request, res: Response) => {
    try {
        // Extract fields from multipart/form-data
        const { title, description, category, gameUrl, price, tags } = req.body;
        
        const updateData: any = {};
        
        // Only include fields that are provided
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (gameUrl !== undefined) updateData.gameUrl = gameUrl;
        if (price !== undefined) updateData.price = price ? parseFloat(price) : 0;
        
        // Parse tags if provided
        if (tags !== undefined) {
            let parsedTags: string[] = [];
            if (tags) {
                try {
                    parsedTags = JSON.parse(tags);
                } catch {
                    // If not JSON, treat as comma-separated string
                    parsedTags = tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
                }
            }
            updateData.tags = parsedTags;
        }
        
        // Handle image if provided
        if (req.file) {
            const existingGame = await domainService.getGameByUUID(req.params.id);
            updateData.imageUrl = await uploadImageBuffer(req.file.buffer, req.file.mimetype, 'games');
            await deleteImageByUrl(existingGame?.imageUrl);
        }
        
        const game = await domainService.updateGame(req.params.id, updateData);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(game);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteGame = async (req: Request, res: Response) => {
    try {
        const game = await domainService.getGameByUUID(req.params.id);
        await domainService.deleteGame(req.params.id);
        await deleteImageByUrl(game?.imageUrl);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const publishGame = async (req: Request, res: Response) => {
    try {
        const game = await domainService.updateGame(req.params.id, {
            published: true,
            publishedAt: new Date()
        });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(game);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const trackView = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        await domainService.createAnalytics({
            gameId: req.params.id,
            eventType: 'view',
            userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const trackPlay = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        await domainService.createAnalytics({
            gameId: req.params.id,
            eventType: 'play',
            userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const trackDownload = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const gameId = req.params.id;
        
        // Get game details for the download file
        const game = await domainService.getGameByUUID(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Track download analytics
        await domainService.createAnalytics({
            gameId,
            eventType: 'download',
            userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Create download file content
        const now = new Date();
        const downloadDate = now.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const downloadTime = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const fileContent = `Thank you for downloading the game: ${game.title}

We hope you enjoy playing!

Downloaded on: ${downloadDate}, ${downloadTime}
`;

        // Set response headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${game.title.replace(/[^a-z0-9]/gi, '_')}_download.txt"`);
        res.send(fileContent);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

// ==================== Purchase Controllers ====================
export const createPurchase = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { gameId, amount, currency, transactionId, paymentMethod, status } = req.body;

        // Validate required fields
        if (!gameId) {
            return res.status(400).json({ error: 'Game ID is required' });
        }

        // If amount is not provided, fetch it from the game
        let purchaseAmount = amount;
        if (!purchaseAmount) {
            const game = await domainService.getGameByUUID(gameId);
            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            purchaseAmount = game.price;
        }

        // Generate transaction ID if not provided
        const finalTransactionId = transactionId || `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const purchase = await domainService.createPurchase({
            userId,
            gameId,
            amount: purchaseAmount,
            currency: currency || 'EUR',
            transactionId: finalTransactionId,
            paymentMethod: paymentMethod || 'card',
            status: status || 'completed'
        });

        res.status(201).json(purchase);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllPurchases = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const purchases = await domainService.getAllPurchases({
            userId: userId || (req.query.userId as string),
            gameId: req.query.gameId as string
        });
        res.json({ purchases }); // Frontend expects { purchases: [...] }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const checkPurchase = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.json({ owns: false });
        }
        const purchases = await domainService.getAllPurchases({
            userId,
            gameId: req.params.id
        });
        res.json({ owns: purchases.length > 0 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getPurchaseWithDetails = async (req: Request, res: Response) => {
    try {
        const purchase = await domainService.getPurchaseWithDetails(req.params.id);
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        res.json(purchase);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deletePurchase = async (req: Request, res: Response) => {
    try {
        await domainService.deletePurchase(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Rating Controllers ====================
export const createRating = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const rating = await domainService.createRating({
            ...req.body,
            userId,
            gameId: req.params.id
        });
        res.status(201).json(rating);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getRatingsByGame = async (req: Request, res: Response) => {
    try {
        const ratings = await domainService.getRatingsByGame(req.params.gameId || req.params.id);
        res.json({ reviews: ratings }); // Frontend expects { reviews: [...] }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const checkRating = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.json({ hasRated: false });
        }
        const ratings = await domainService.getRatingsByGame(req.params.id);
        const hasRated = ratings.some(r => r.userId === userId);
        res.json({ hasRated });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteRating = async (req: Request, res: Response) => {
    try {
        await domainService.deleteRating(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Ad Controllers ====================
export const createAd = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }
        const ad = await domainService.createAd({
            ...req.body,
            imageUrl: await uploadImageBuffer(req.file.buffer, req.file.mimetype, 'ads'),
            createdBy: userId
        });
        res.status(201).json(ad);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllAds = async (req: Request, res: Response) => {
    try {
        const ads = await domainService.getAllAds({
            active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
        });
        const position = req.query.position as string | undefined;
        const filteredAds = position ? ads.filter((ad: any) => ad.position === position) : ads;
        res.json({ ads: filteredAds });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteAd = async (req: Request, res: Response) => {
    try {
        const ads = await domainService.getAllAds();
        const ad = ads.find((item: any) => item.id === req.params.id);
        await domainService.deleteAd(req.params.id);
        await deleteImageByUrl(ad?.imageUrl);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateAd = async (req: Request, res: Response) => {
    try {
        const ads = await domainService.getAllAds();
        const existingAd = ads.find((item: any) => item.id === req.params.id);
        const updateData: any = { ...req.body };
        if (req.file) {
            updateData.imageUrl = await uploadImageBuffer(req.file.buffer, req.file.mimetype, 'ads');
            await deleteImageByUrl(existingAd?.imageUrl);
        }
        const ad = await domainService.updateAd(req.params.id, updateData);
        if (!ad) {
            return res.status(404).json({ error: 'Ad not found' });
        }
        res.json(ad);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const trackAdClick = async (req: Request, res: Response) => {
    try {
        await domainService.trackAdClick(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAdImage = async (req: Request, res: Response) => {
    try {
        const ads = await domainService.getAllAds();
        const ad = ads.find((item: any) => item.id === req.params.id);
        if (!ad?.imageUrl) {
            return res.status(404).json({ error: 'Ad image not found' });
        }
        res.redirect(ad.imageUrl);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Analytics Controllers ====================
export const createAnalytics = async (req: Request, res: Response) => {
    try {
        const analytics = await domainService.createAnalytics({
            ...req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        res.status(201).json(analytics);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getAnalyticsByGame = async (req: Request, res: Response) => {
    try {
        const analytics = await domainService.getAnalyticsByGame(req.params.gameId);
        res.json(analytics);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAnalyticsWithGame = async (req: Request, res: Response) => {
    try {
        const analytics = await domainService.getAnalyticsWithGame(req.params.id);
        if (!analytics) {
            return res.status(404).json({ error: 'Analytics not found' });
        }
        res.json(analytics);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteAnalytics = async (req: Request, res: Response) => {
    try {
        await domainService.deleteAnalytics(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Session Controllers ====================
export const createSession = async (req: Request, res: Response) => {
    try {
        const session = await domainService.createSession({
            ...req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        res.status(201).json(session);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const getSession = async (req: Request, res: Response) => {
    try {
        const session = await domainService.getSessionByToken(req.params.token);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAllSessions = async (req: Request, res: Response) => {
    try {
        const sessions = await domainService.getAllSessions({
            userId: req.query.userId as string
        });
        res.json(sessions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteSession = async (req: Request, res: Response) => {
    try {
        await domainService.deleteSession(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ==================== Auth Controllers ====================
export const register = async (req: Request, res: Response) => {
    try {
        const { username, email, password } = req.body;
        const user = await domainService.createUser({ username, email, password });

        // Automatically log in the user after registration
        const result = await domainService.login(
            user.email,
            password,
            req.ip,
            req.get('user-agent')
        );
        
        res.status(201).json({
            token: result.token,
            user: result.user
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const result = await domainService.login(
            req.body.email, 
            req.body.password,
            req.ip,
            req.get('user-agent')
        );
        res.json(result);
    } catch (error: any) {
        res.status(401).json({ error: error.message });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await domainService.getUserByUUID(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user }); // Frontend expects { user: {...} }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAnalyticsDashboard = async (req: Request, res: Response) => {
    try {
        const dashboard = await domainService.getAnalyticsDashboard();
        res.json(dashboard);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getRevenueBreakdown = async (req: Request, res: Response) => {
    try {
        const breakdown = await domainService.getRevenueBreakdown();
        res.json(breakdown);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getRecommendations = async (req: Request, res: Response) => {
    try {
        const recommendations = await domainService.getRecommendations(req.params.userId);
        res.json(recommendations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTrendingAnalytics = async (req: Request, res: Response) => {
    try {
        const trending = await domainService.getTrendingAnalytics();
        res.json(trending);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
