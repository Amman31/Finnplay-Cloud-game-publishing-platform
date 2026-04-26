import getPrismaClient from '../db/prismaConnection';

const prisma = getPrismaClient();

export const getCoreAnalyticsStats = async () => {
    const [games, analytics, purchases, users] = await Promise.all([
        prisma.game.count(),
        prisma.analytics.findMany(),
        prisma.purchase.findMany({ where: { status: 'completed' } }),
        prisma.user.count()
    ]);

    const totalViews = analytics.filter((a) => a.eventType === 'view').length;
    const totalDownloads = analytics.filter((a) => a.eventType === 'download').length;
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);

    return {
        totalGames: games,
        totalViews,
        totalDownloads,
        totalRevenue,
        totalUsers: users
    };
};
