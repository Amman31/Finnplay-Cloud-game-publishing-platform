'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import env from '@/config/variables';

interface User {
    _id: string;
    username: string;
    email: string;
    role: string;
    createdAt: string;
}

interface Game {
    id?: string;
    _id?: string;
    title: string;
    price: number;
    /** Populated purchase detail / catalog */
    imageUrl?: string;
    image?: string;
}

interface Purchase {
    id?: string;
    gameId: Game | string; // Can be populated Game object or UUID string
    amount: number;
    currency: string;
    transactionId: string;
    paymentMethod: string;
    status: 'completed' | 'pending' | 'failed';
    createdAt: string;
}

export default function ProfilePage() {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
            return;
        }

        if (authUser) {
            fetchUserData();
            fetchPurchases();
        }
    }, [authUser, authLoading, router]);

    const fetchUserData = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data.user);
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchases = async () => {
        try {
            const response = await api.get('/purchases');
            setPurchases(response.data.purchases || []);
        } catch (error) {
            console.error('Failed to fetch purchases:', error);
        }
    };

    const handleGameCardClick = async (gameId: string, e: React.MouseEvent) => {
        // Track view event when clicking on game card
        try {
            await api.post(`/games/${gameId}/view`);
        } catch (error) {
            // Silently fail - don't block navigation if analytics fails
            console.error('Failed to track view:', error);
        }
        // Navigation will continue normally via Link
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="text-center text-white py-12">Loading...</div>
            </div>
        );
    }

    if (!authUser || !user) {
        return null;
    }

    const totalSpent = purchases
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);

    const completedPurchases = purchases.filter(p => p.status === 'completed');
    const pendingPurchases = purchases.filter(p => p.status === 'pending');
    const failedPurchases = purchases.filter(p => p.status === 'failed');

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-4xl font-bold text-white mb-8">My Profile</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* User Details Section */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
                            <h2 className="text-2xl font-bold text-white mb-6">Account Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-gray-300 text-sm">Username</label>
                                    <div className="text-white font-semibold text-lg">{user.username}</div>
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm">Email</label>
                                    <div className="text-white font-semibold text-lg">{user.email}</div>
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm">Member Since</label>
                                    <div className="text-white font-semibold text-lg">
                                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Statistics Card */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">Statistics</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">Total Games Owned</span>
                                    <span className="text-white font-bold text-xl">{completedPurchases.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">Total Spent</span>
                                    <span className="text-green-400 font-bold text-xl">€{totalSpent.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">Pending Purchases</span>
                                    <span className="text-yellow-400 font-bold text-xl">{pendingPurchases.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">Failed Purchases</span>
                                    <span className="text-red-400 font-bold text-xl">{failedPurchases.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Purchased Games Section */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">My Games ({completedPurchases.length})</h2>
                            {completedPurchases.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-200 text-lg mb-4">You haven&apos;t purchased any games yet.</p>
                                    <Link
                                        href="/games"
                                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                                    >
                                        Browse Games
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {completedPurchases.map((purchase) => {
                                        // Handle gameId - can be populated object or UUID string
                                        const gameId = typeof purchase.gameId === 'string'
                                            ? purchase.gameId
                                            : purchase.gameId?.id || '';
                                        const gameTitle = typeof purchase.gameId === 'object'
                                            ? purchase.gameId.title
                                            : 'Game';

                                        return (
                                            <Link
                                                key={purchase.id || purchase.transactionId}
                                                href={`/games/${gameId}`}
                                                onClick={(e) => handleGameCardClick(gameId, e)}
                                                className="bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden border border-white/10 transition-all transform hover:scale-105"
                                            >
                                                <div className="flex gap-4 p-4">
                                                    <div className="w-20 h-28 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                                                        {gameId && (
                                                            <img
                                                                src={
                                                                    typeof purchase.gameId === 'object' && purchase.gameId?.imageUrl
                                                                        ? purchase.gameId.imageUrl
                                                                        : `${env.API_URL}/games/${gameId}/image`
                                                                }
                                                                alt={gameTitle}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <h3 className="text-white font-semibold text-lg mb-1 line-clamp-2">
                                                                {gameTitle}
                                                            </h3>
                                                            <p className="text-gray-400 text-sm">
                                                                Purchased: {new Date(purchase.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="text-green-400 font-semibold">
                                                            €{purchase.amount.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Payment History Section */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">Payment History</h2>
                            {purchases.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-200 text-lg">No payment history available.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/20">
                                                <th className="text-left text-gray-200 font-semibold py-3 px-4">Date</th>
                                                <th className="text-left text-gray-200 font-semibold py-3 px-4">Amount</th>
                                                <th className="text-left text-gray-200 font-semibold py-3 px-4">Transaction ID</th>
                                                <th className="text-left text-gray-200 font-semibold py-3 px-4">Payment Method</th>
                                                <th className="text-left text-gray-200 font-semibold py-3 px-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {purchases.map((purchase) => {
                                                // Handle gameId - can be populated object or UUID string
                                                const gameId = typeof purchase.gameId === 'string'
                                                    ? purchase.gameId
                                                    : purchase.gameId?.id || '';
                                                const gameTitle = typeof purchase.gameId === 'object'
                                                    ? purchase.gameId.title
                                                    : 'Game';

                                                return (
                                                    <tr
                                                        key={purchase.id || purchase.transactionId}
                                                        className="border-b border-white/10 hover:bg-white/5 transition"
                                                    >
                                                        <td className="text-white py-3 px-4">
                                                            {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="text-white py-3 px-4 font-semibold">
                                                            €{purchase.amount.toFixed(2)}
                                                        </td>
                                                        <td className="text-gray-200 py-3 px-4 text-sm font-mono">
                                                            {purchase.transactionId}
                                                        </td>
                                                        <td className="text-white py-3 px-4 capitalize">
                                                            {purchase.paymentMethod}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span
                                                                className={`px-3 py-1 rounded-full text-xs font-semibold ${purchase.status === 'completed'
                                                                    ? 'bg-green-500/20 text-green-400'
                                                                    : purchase.status === 'pending'
                                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                                        : 'bg-red-500/20 text-red-400'
                                                                    }`}
                                                            >
                                                                {purchase.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

