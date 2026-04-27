/** Shape of GET /analytics/dashboard JSON used by admin dashboard and analytics page */

export interface TimeSeriesBucket {
    _id: string;
    count?: number;
    revenue?: number;
}

export interface CategoryStatRow {
    _id?: string;
    count?: number;
    totalViews?: number;
    totalDownloads?: number;
    avgRating?: number;
}

export interface EventBreakdownRow {
    _id?: string;
    count?: number;
}

export interface TopGameRevenueRow {
    title?: string;
    revenue?: number;
    purchases?: number;
}

export interface TopGameListRow {
    id?: string;
    title?: string;
    views?: number;
    downloads?: number;
    rating?: number;
}

export interface AnalyticsDashboardData {
    stats?: {
        totalRevenueCombined?: number;
        totalRevenue?: number;
        adRevenue?: number;
        totalGames?: number;
        publishedGames?: number;
        draftGames?: number;
        totalViews?: number;
        avgViews?: number;
        totalDownloads?: number;
        totalUsers?: number;
        totalPurchases?: number;
        purchaseRate?: number;
        avgRating?: number;
        avgDownloads?: number;
    };
    timeSeries?: {
        views?: TimeSeriesBucket[];
        downloads?: TimeSeriesBucket[];
        revenue?: TimeSeriesBucket[];
    };
    categoryStats?: CategoryStatRow[];
    eventBreakdown?: EventBreakdownRow[];
    topGames?: {
        byRevenue?: TopGameRevenueRow[];
        byViews?: TopGameListRow[];
        byDownloads?: TopGameListRow[];
    };
}
