'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import GameAdCard from '@/components/GameAdCard';
import api from '@/lib/api';
import env from '@/config/variables';

interface Game {
    id: string;
    title: string;
    description: string;
    category: string;
    views?: number;
    downloads?: number;
    rating?: number;
    totalRatings?: number;
    price: number;
    createdAt?: string;
    imageUrl?: string;
}

export default function GamesPage() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        fetchGames();
    }, [category, search]);

    const fetchGames = async () => {
        try {
            const params: any = {};
            if (search) params.search = search;
            if (category) params.category = category;

            const response = await api.get('/games', { params });
            let allGames = response.data.games;

            setGames(allGames);
        } catch (error) {
            console.error('Failed to fetch games:', error);
        } finally {
            setLoading(false);
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-6">All Games</h1>

                    {/* Search and Category Filter */}
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Search games by title or description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="" className="bg-gray-800 text-white">All Categories</option>
                            <option value="action" className="bg-gray-800 text-white">Action</option>
                            <option value="adventure" className="bg-gray-800 text-white">Adventure</option>
                            <option value="puzzle" className="bg-gray-800 text-white">Puzzle</option>
                            <option value="strategy" className="bg-gray-800 text-white">Strategy</option>
                            <option value="sports" className="bg-gray-800 text-white">Sports</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center text-white">Loading games...</div>
                ) : games.length === 0 ? (
                    <div className="text-center text-white">No games found</div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {games.map((game, index) => (
                            <React.Fragment key={game.id}>
                                <Link
                                    href={`/games/${game.id}`}
                                    onClick={(e) => handleGameCardClick(game.id, e)}
                                    className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden shadow-lg hover:scale-102 ease-in-out transform duration-300 transition-transform border border-white/20 flex flex-col"
                                >
                                    <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center relative overflow-hidden">
                                        <img
                                            src={game.imageUrl || `${env.API_URL}/games/${game.id}/image`}
                                            alt={game.title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                console.error('Image load error:', target.src);
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent && !parent.querySelector('.error-message')) {
                                                    const errorMsg = document.createElement('span');
                                                    errorMsg.className = 'error-message text-gray-400';
                                                    errorMsg.textContent = 'No Image';
                                                    parent.appendChild(errorMsg);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col">
                                        <h3 className="text-base font-semibold text-white mb-1 line-clamp-2">{game.title}</h3>
                                        <p className="text-gray-300 text-xs mb-2 line-clamp-2 flex-1">{game.description}</p>
                                        <div className="flex justify-between items-center mt-auto">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <span
                                                            key={i}
                                                            className={`text-xs ${i < Math.floor(game.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                                        >
                                                            ★
                                                        </span>
                                                    ))}
                                                    <span className="text-xs text-gray-200 ml-1">
                                                        {(game.rating || 0).toFixed(1)}
                                                        {game.totalRatings !== undefined && game.totalRatings > 0 && (
                                                            <span className="text-gray-400 ml-1">({game.totalRatings})</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <span className="bg-blue-600 px-2 py-1 rounded text-white text-xs w-fit capitalize">{game.category}</span>
                                            </div>
                                            <div className="text-base font-bold text-white">€{game.price.toFixed(2)}</div>
                                        </div>
                                    </div>
                                </Link>
                                {/* Insert ad every 5 games (after 4th, 9th, 14th, etc.) */}
                                {(index + 1) % 5 === 0 && (index + 1) < games.length && (
                                    <GameAdCard key={`ad-${index}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

