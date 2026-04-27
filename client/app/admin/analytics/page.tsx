'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/errors';
import type {
    AnalyticsDashboardData,
    CategoryStatRow,
    EventBreakdownRow,
    TimeSeriesBucket,
    TopGameListRow,
    TopGameRevenueRow,
} from '@/types/dashboard';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function AnalyticsPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [analytics, setAnalytics] = useState<AnalyticsDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchAnalytics();
        }
    }, [isAdmin]);

    const fetchAnalytics = async () => {
        try {
            setLoadError(null);
            const response = await api.get('/analytics/dashboard');
            setAnalytics(response.data);
            if (response.data?.timeSeries?.revenue) {
                console.log('Revenue data:', response.data.timeSeries.revenue);
            }
        } catch (error: unknown) {
            console.error('Failed to fetch analytics:', error);
            setAnalytics(null);
            setLoadError(getAxiosErrorMessage(error, 'The analytics service is unavailable.'));
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="text-center text-white py-12">Loading...</div>
            </div>
        );
    }

    if (!isAdmin) return null;

    if (loadError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Analytics unavailable</h1>
                    <p className="text-gray-300 mb-2">
                        Dashboard data is served only from the analytics microservice. It did not return successfully.
                    </p>
                    <p className="text-sm text-red-300/90 font-mono break-words">{loadError}</p>
                </div>
            </div>
        );
    }

    // Prepare data for charts - ensure all data is dynamic from API
    const prepareTimeSeriesData = (data: TimeSeriesBucket[] | undefined, isRevenue = false): Map<string, number> => {
        if (!data || !Array.isArray(data)) return new Map();
        const dataMap = new Map<string, number>();
        data.forEach(item => {
            if (item && item._id) {
                // For revenue, use the revenue field; for others, use count
                const value = isRevenue ? (item.revenue || 0) : (item.count || 0);
                dataMap.set(item._id, value);
            }
        });
        return dataMap;
    };

    const viewsMap = prepareTimeSeriesData(analytics?.timeSeries?.views || [], false);
    const downloadsMap = prepareTimeSeriesData(analytics?.timeSeries?.downloads || [], false);
    const revenueMap = prepareTimeSeriesData(analytics?.timeSeries?.revenue || [], true);

    // Get all unique dates from actual data
    const allDates = new Set([
        ...Array.from(viewsMap.keys()),
        ...Array.from(downloadsMap.keys()),
        ...Array.from(revenueMap.keys())
    ]);
    const sortedDates = Array.from(allDates).sort();

    // Create time series data from actual database data
    const timeSeriesData = sortedDates.length > 0
        ? sortedDates.map(date => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            views: viewsMap.get(date) || 0,
            downloads: downloadsMap.get(date) || 0,
            revenue: revenueMap.get(date) || 0
        }))
        : []; // Empty array if no data

    // Category data from actual database - ensure dynamic
    const categoryData = (analytics?.categoryStats && Array.isArray(analytics.categoryStats))
        ? analytics.categoryStats.map((cat: CategoryStatRow) => ({
            name: cat._id || 'Unknown',
            games: cat.count || 0,
            views: cat.totalViews || 0,
            downloads: cat.totalDownloads || 0,
            avgRating: Number((cat.avgRating || 0).toFixed(2))
        }))
        : [];

    // Event breakdown from actual analytics data
    const eventData = (analytics?.eventBreakdown && Array.isArray(analytics.eventBreakdown))
        ? analytics.eventBreakdown.map((event: EventBreakdownRow) => ({
            name: event._id ? (event._id.charAt(0).toUpperCase() + event._id.slice(1)) : 'Unknown',
            value: event.count || 0
        }))
        : [];

    // Top games by revenue from actual purchase data
    const topGamesByRevenue = (analytics?.topGames?.byRevenue && Array.isArray(analytics.topGames.byRevenue))
        ? analytics.topGames.byRevenue.map((game: TopGameRevenueRow) => ({
            name: game.title ? (game.title.length > 20 ? game.title.substring(0, 20) + '...' : game.title) : 'Unknown',
            revenue: game.revenue || 0,
            purchases: game.purchases || 0
        }))
        : [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-4xl font-bold text-white mb-8">Analytics Dashboard</h1>

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div
                        className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 cursor-pointer hover:bg-white/15 transition-all transform hover:scale-105"
                    >
                        <h3 className="text-gray-200 text-sm mb-2">Total Revenue</h3>
                        <p className="text-3xl font-bold text-green-400">
                            €{(analytics?.stats?.totalRevenueCombined || 0).toFixed(2)}
                        </p>
                        <p className="text-gray-300 text-xs mt-2">
                            €{(analytics?.stats?.totalRevenue || 0).toFixed(2)} from purchases
                            {(analytics?.stats?.adRevenue ?? 0) > 0 && (
                                <span> + €{(analytics?.stats?.adRevenue || 0).toFixed(2)} from ads</span>
                            )}
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Total Games</h3>
                        <p className="text-3xl font-bold text-white">{analytics?.stats?.totalGames || 0}</p>
                        <p className="text-gray-300 text-xs mt-2">
                            {analytics?.stats?.publishedGames || 0} published, {analytics?.stats?.draftGames || 0} drafts
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Total Views</h3>
                        <p className="text-3xl font-bold text-blue-400">
                            {(analytics?.stats?.totalViews || 0).toLocaleString()}
                        </p>
                        <p className="text-gray-300 text-xs mt-2">
                            Avg: {Math.round(analytics?.stats?.avgViews || 0).toLocaleString()} per game
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Total Downloads</h3>
                        <p className="text-3xl font-bold text-purple-400">
                            {(analytics?.stats?.totalDownloads || 0).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Total Users</h3>
                        <p className="text-3xl font-bold text-white">{analytics?.stats?.totalUsers || 0}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Total Purchases</h3>
                        <p className="text-3xl font-bold text-green-400">{analytics?.stats?.totalPurchases || 0}</p>
                        <p className="text-gray-300 text-xs mt-2">
                            Purchase rate: {analytics?.stats?.purchaseRate || 0}%
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Average Rating</h3>
                        <p className="text-3xl font-bold text-yellow-400">
                            {(analytics?.stats?.avgRating || 0).toFixed(1)}
                        </p>
                        <p className="text-gray-300 text-xs mt-2">Out of 5.0</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-200 text-sm mb-2">Avg Downloads</h3>
                        <p className="text-3xl font-bold text-cyan-400">
                            {Math.round(analytics?.stats?.avgDownloads || 0).toLocaleString()}
                        </p>
                        <p className="text-gray-300 text-xs mt-2">Per game</p>
                    </div>
                </div>

                {/* Time Series Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Views & Downloads Over Time */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Views & Downloads (Last 30 Days)</h2>
                        {timeSeriesData.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-gray-400">
                                <p>No data available for the last 30 days</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={timeSeriesData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                    <XAxis dataKey="date" stroke="#ffffff80" fontSize={12} />
                                    <YAxis stroke="#ffffff80" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="views"
                                        stackId="1"
                                        stroke="#3b82f6"
                                        fill="#3b82f6"
                                        fillOpacity={0.6}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="downloads"
                                        stackId="1"
                                        stroke="#8b5cf6"
                                        fill="#8b5cf6"
                                        fillOpacity={0.6}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Revenue Over Time */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Revenue (Last 30 Days)</h2>
                        {timeSeriesData.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-gray-400">
                                <p>No revenue data available for the last 30 days</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={timeSeriesData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                    <XAxis dataKey="date" stroke="#ffffff80" fontSize={12} />
                                    <YAxis stroke="#ffffff80" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value: number | string) =>
                                            `€${Number(value).toFixed(2)}`
                                        }
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ fill: '#10b981', r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Category and Event Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Category Performance */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Games by Category</h2>
                        {categoryData.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-gray-400">
                                <p>No category data available</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={categoryData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                    <XAxis dataKey="name" stroke="#ffffff80" fontSize={12} />
                                    <YAxis stroke="#ffffff80" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="games" fill="#3b82f6" name="Games" />
                                    <Bar dataKey="views" fill="#8b5cf6" name="Views" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Event Type Breakdown */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Event Type Distribution</h2>
                        {eventData.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-gray-400">
                                <p>No event data available</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={eventData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {eventData.map((entry, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Games by Revenue */}
                {topGamesByRevenue.length > 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Top Games by Revenue</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topGamesByRevenue} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                <XAxis type="number" stroke="#ffffff80" fontSize={12} />
                                <YAxis dataKey="name" type="category" stroke="#ffffff80" fontSize={12} width={150} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '8px',
                                        color: '#fff'
                                    }}
                                    formatter={(value: number | string, name: string) => {
                                        if (name === 'Revenue') {
                                            return `€${Number(value).toFixed(2)}`;
                                        }
                                        if (name === 'Purchases') {
                                            return Number(value).toLocaleString();
                                        }
                                        return String(value);
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                                <Bar dataKey="purchases" fill="#3b82f6" name="Purchases" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Top Games by Revenue</h2>
                        <div className="h-[300px] flex items-center justify-center text-gray-200">
                            <p>No revenue data available yet</p>
                        </div>
                    </div>
                )}



                {/* Top Games Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Top Games by Views */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Top Games by Views</h2>
                        <div className="space-y-3">
                            {(analytics?.topGames?.byViews && Array.isArray(analytics.topGames.byViews) && analytics.topGames.byViews.length > 0) ? (
                                analytics.topGames.byViews.slice(0, 5).map((game: TopGameListRow, index: number) => (
                                    <div key={game.id} className="flex justify-between items-center p-4 bg-white/5 rounded">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-bold text-yellow-400 w-8">#{index + 1}</span>
                                            <div>
                                                <h3 className="text-white font-semibold">{game.title}</h3>
                                                <p className="text-gray-300 text-sm">
                                                    {game.downloads} downloads • Rating: {game.rating?.toFixed(1) || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-blue-400 font-bold">{(game.views ?? 0).toLocaleString()}</p>
                                            <p className="text-gray-300 text-xs">views</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-200 text-center py-8">No games data available</p>
                            )}
                        </div>
                    </div>

                    {/* Top Games by Downloads */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Top Games by Downloads</h2>
                        <div className="space-y-3">
                            {(analytics?.topGames?.byDownloads && Array.isArray(analytics.topGames.byDownloads) && analytics.topGames.byDownloads.length > 0) ? (
                                analytics.topGames.byDownloads.slice(0, 5).map((game: TopGameListRow, index: number) => (
                                    <div key={game.id} className="flex justify-between items-center p-4 bg-white/5 rounded">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-bold text-yellow-400 w-8">#{index + 1}</span>
                                            <div>
                                                <h3 className="text-white font-semibold">{game.title}</h3>
                                                <p className="text-gray-300 text-sm">
                                                    {game.views} views • Rating: {game.rating?.toFixed(1) || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-purple-300 font-bold">{(game.downloads ?? 0).toLocaleString()}</p>
                                            <p className="text-gray-300 text-xs">downloads</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-200 text-center py-8">No games data available</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
