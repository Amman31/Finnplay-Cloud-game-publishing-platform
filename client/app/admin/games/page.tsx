'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import api from '@/lib/api';

interface Game {
    id: string;
    title: string;
    description: string;
    category: string;
    published: boolean;
    views: number;
    downloads: number;
    createdAt: string;
}

export default function AdminGamesPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchGames();
        }
    }, [isAdmin]);

    const fetchGames = async () => {
        try {
            // For admins, don't pass published parameter to get all games
            const response = await api.get('/games');
            setGames(response.data.games || []);
        } catch (error) {
            console.error('Failed to fetch games:', error);
            setGames([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (id: string) => {
        try {
            await api.patch(`/games/${id}/publish`);
            fetchGames();
        } catch (error) {
            console.error('Failed to publish game:', error);
            alert('Failed to publish game');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this game?')) return;
        
        try {
            await api.delete(`/games/${id}`);
            fetchGames();
        } catch (error) {
            console.error('Failed to delete game:', error);
            alert('Failed to delete game');
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Manage Games</h1>
                    <Link
                        href="/admin/games/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                    >
                        Create New Game
                    </Link>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    {games.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-lg mb-4">No games found.</p>
                            <Link
                                href="/admin/games/new"
                                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                            >
                                Create Your First Game
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-white">
                                <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="text-left p-4">Title</th>
                                        <th className="text-left p-4">Category</th>
                                        <th className="text-left p-4">Status</th>
                                        <th className="text-left p-4">Views</th>
                                        <th className="text-left p-4">Downloads</th>
                                        <th className="text-left p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {games.map((game) => (
                                        <tr key={game.id} className="border-b border-white/10">
                                            <td className="p-4">{game.title}</td>
                                            <td className="p-4 capitalize">{game.category}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded ${game.published ? 'bg-green-600' : 'bg-yellow-600'}`}>
                                                    {game.published ? 'Published' : 'Draft'}
                                                </span>
                                            </td>
                                            <td className="p-4">{game.views}</td>
                                            <td className="p-4">{game.downloads}</td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    {!game.published && (
                                                        <button
                                                            onClick={() => handlePublish(game.id)}
                                                            className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                                                        >
                                                            Publish
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/admin/games/${game.id}/edit`}
                                                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(game.id)}
                                                        className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

