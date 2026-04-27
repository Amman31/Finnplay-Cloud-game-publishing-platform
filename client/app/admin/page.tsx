'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import api from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/errors';
import type { AnalyticsDashboardData, TopGameListRow } from '@/types/dashboard';

export default function AdminDashboard() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<AnalyticsDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
        }
    }, [isAdmin]);

    const fetchStats = async () => {
        try {
            setStatsError(null);
            const response = await api.get('/analytics/dashboard');
            setStats(response.data);
        } catch (error: unknown) {
            console.error('Failed to fetch stats:', error);
            setStats(null);
            setStatsError(getAxiosErrorMessage(error, 'The analytics service is unavailable.'));
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

    if (!isAdmin) {
        return null;
    }

    if (statsError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Admin overview unavailable</h1>
                    <p className="text-gray-300 mb-2">
                        Summary stats are loaded only from the analytics microservice. It did not return successfully.
                    </p>
                    <p className="text-sm text-red-300/90 font-mono break-words">{statsError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-4xl font-bold text-white mb-8">Admin Dashboard</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-300 mb-2">Total Games</h3>
                        <p className="text-3xl font-bold text-white">{stats?.stats?.totalGames || 0}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-300 mb-2">Published Games</h3>
                        <p className="text-3xl font-bold text-white">{stats?.stats?.publishedGames || 0}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-300 mb-2">Total Views</h3>
                        <p className="text-3xl font-bold text-white">{stats?.stats?.totalViews || 0}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h3 className="text-gray-300 mb-2">Total Downloads</h3>
                        <p className="text-3xl font-bold text-white">{stats?.stats?.totalDownloads || 0}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            <Link
                                href="/admin/games/new"
                                className="block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition text-center"
                            >
                                Publish New Game
                            </Link>
                            <Link
                                href="/admin/games"
                                className="block bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition text-center"
                            >
                                Manage Games
                            </Link>
                            <Link
                                href="/admin/analytics"
                                className="block bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition text-center"
                            >
                                View Analytics
                            </Link>
                            <Link
                                href="/admin/ads"
                                className="block bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-6 py-3 rounded-lg transition text-center"
                            >
                                Manage Ads
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                        <h2 className="text-2xl font-bold text-white mb-4">Top Games</h2>
                        <div className="space-y-3">
                            {(stats?.topGames?.byViews && Array.isArray(stats.topGames.byViews) && stats.topGames.byViews.length > 0) ? (
                                stats.topGames.byViews.slice(0, 5).map((game: TopGameListRow) => (
                                    <div key={game.id} className="flex justify-between items-center p-3 bg-white/5 rounded">
                                        <span className="text-white">{game.title}</span>
                                        <span className="text-gray-300">{game.views ?? 0} views</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400">No games yet</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

