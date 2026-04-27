'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AdBanner from '@/components/AdBanner';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import api from '@/lib/api';
import env from '@/config/variables';
import { getAxiosErrorMessage } from '@/lib/errors';

interface Game {
    id: string;
    title: string;
    description: string;
    category: string;
    gameUrl: string;
    views?: number;
    downloads?: number;
    rating?: number;
    totalRatings?: number;
    price: number;
    tags: string[];
    publishedAt?: string;
    createdAt?: string;
    imageUrl?: string;
}

interface GameReview {
    id: string;
    userId: string;
    rating: number;
    review: string;
    createdAt: string;
    user?: { username?: string };
}

export default function GameDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [ownsGame, setOwnsGame] = useState(false);
    const [checkingOwnership, setCheckingOwnership] = useState(true);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<'starting' | 'complete'>('starting');
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [hasRated, setHasRated] = useState(false);
    const [reviews, setReviews] = useState<GameReview[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchGame();
            fetchReviews();
            if (user) {
                checkOwnership();
            } else {
                setCheckingOwnership(false);
            }
        }
    }, [params.id, user]);

    // Check if user has rated when reviews are loaded or user changes
    useEffect(() => {
        if (user && ownsGame) {
            if (reviews.length > 0) {
                // Check if current user's review is in the list
                const userHasRated = reviews.some((r: GameReview) => r.userId === user.id);
                setHasRated(userHasRated);
            } else {
                // If no reviews yet, check rating status via API
                checkIfRated();
            }
        }
    }, [reviews, user, ownsGame]);

    useEffect(() => {
        // Check URL for purchased parameter and refresh ownership
        if (typeof window !== 'undefined' && game && user) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('purchased') === 'true') {
                // Force refresh ownership check
                checkOwnership();
                // Remove the query parameter from URL without reload
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, [game, user]);

    const checkIfRated = async (gameData?: Game | null) => {
        const gameToCheck = gameData || game;
        if (!user || !gameToCheck) return;
        try {
            const response = await api.get(`/games/${params.id}/rating/check`);
            const hasRatedValue = response.data.hasRated || false;
            setHasRated(hasRatedValue);
            // Show rating prompt if they haven't rated
            if (!hasRatedValue) {
                setTimeout(() => {
                    setShowRatingModal(true);
                }, 2000); // Show after 2 seconds
            }
        } catch (error) {
            console.error('Failed to check rating status:', error);
        }
    };

    const fetchGame = async () => {
        try {
            const response = await api.get(`/games/${params.id}`);
            const gameData = response.data.game;
            setGame(gameData);
            // Check if rated after game is loaded
            if (user && typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('purchased') === 'true') {
                    checkIfRated(gameData);
                }
            }
        } catch (error) {
            console.error('Failed to fetch game:', error);
            router.push('/games');
        } finally {
            setLoading(false);
        }
    };

    const checkOwnership = async () => {
        if (!user) {
            setCheckingOwnership(false);
            setOwnsGame(false);
            return;
        }
        try {
            setCheckingOwnership(true);
            const response = await api.get(`/purchases/check/${params.id}`);
            setOwnsGame(response.data.owns || false);
        } catch (error) {
            console.error('Failed to check ownership:', error);
            setOwnsGame(false);
        } finally {
            setCheckingOwnership(false);
        }
    };

    const handlePlay = async (e: React.MouseEvent) => {
        e.preventDefault();

        if (!user) {
            router.push('/login');
            return;
        }

        if (!ownsGame || !game) {
            alert('You must purchase this game before playing');
            return;
        }

        // Track play event
        try {
            await api.post(`/games/${params.id}/play`);
        } catch (error: unknown) {
            // If tracking fails, still allow play but log error
            console.error('Failed to track play event:', error);
            // Don't block the user from playing if analytics fails
        }

        // Open game URL in new tab
        window.open(game.gameUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownload = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        if (!ownsGame) {
            alert('You must purchase this game before downloading');
            return;
        }

        // Show download modal
        setShowDownloadModal(true);
        setDownloadStatus('starting');

        try {
            const response = await api.post(`/games/${params.id}/download`, {}, {
                responseType: 'blob' // Important: expect binary data
            });

            // Create a blob from the response
            const blob = new Blob([response.data], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Get filename from Content-Disposition header or use game title
            const contentDisposition = response.headers['content-disposition'];
            let filename = `${game?.title || 'game'}_download.txt`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // Update download status
            setDownloadStatus('complete');
            // Refresh game data to update download count
            fetchGame();

            // Close modal after 2 seconds
            setTimeout(() => {
                setShowDownloadModal(false);
            }, 2000);
        } catch (error: unknown) {
            console.error('Download failed:', error);
            setShowDownloadModal(false);
            alert(getAxiosErrorMessage(error, 'Failed to download game'));
        }
    };

    const fetchReviews = async () => {
        try {
            setLoadingReviews(true);
            const response = await api.get(`/games/${params.id}/reviews`);
            setReviews(response.data.reviews || []);
        } catch (error) {
            console.error('Failed to fetch reviews:', error);
        } finally {
            setLoadingReviews(false);
        }
    };

    const handleRatingSubmit = async () => {
        if (!user || !game || rating === 0 || !review.trim()) {
            alert('Please provide both a rating and a review');
            return;
        }

        try {
            await api.post(`/games/${params.id}/rating`, { rating, review });
            setShowRatingModal(false);
            setHasRated(true);
            setRating(0);
            setReview('');
            // Refresh game data and reviews
            await fetchGame();
            await fetchReviews();
            // Double-check rating status after refresh
            await checkIfRated();
        } catch (error: unknown) {
            console.error('Failed to submit rating:', error);
            const errorMessage = getAxiosErrorMessage(error, 'Failed to submit rating');
            alert(errorMessage);
            // If user already reviewed, close the modal and refresh
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 400 &&
                (errorMessage.includes('already written') || errorMessage.includes('already'))
            ) {
                setShowRatingModal(false);
                setHasRated(true);
                await fetchGame();
                await fetchReviews();
                await checkIfRated();
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="text-center text-white py-12">Loading...</div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <Navbar />
                <div className="text-center text-white py-12">Game not found</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section - Portrait Poster Style */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Portrait Game Poster */}
                        <div className="flex-shrink-0">
                            <div className="w-full md:w-64 lg:w-80 rounded-xl overflow-hidden shadow-2xl">
                                <img
                                    src={game.imageUrl || `${env.API_URL}/games/${params.id}/image`}
                                    alt={game.title}
                                    className="w-full h-auto object-cover aspect-[2/3]"
                                    onError={(e) => {
                                        console.error('Game poster image load error');
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        </div>
                        <div className='flex flex-col gap-2 justify-center ml-2'>
                            {/* Description Section */}
                            <div className="flex-1 flex flex-col justify-center">
                                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{game.title}</h1>
                                <div className="flex flex-wrap gap-4 items-center mb-4">
                                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                                        <span className="text-yellow-400 font-bold text-xl">{(game.rating || 0).toFixed(1)}</span>
                                        <span className="text-white">/ 5.0</span>
                                        <span className="text-gray-300 text-sm ml-2">({game.totalRatings || 0} ratings)</span>
                                    </div>
                                    <span className="bg-blue-600 px-4 py-2 rounded-lg text-white font-semibold capitalize">
                                        {game.category}
                                    </span>
                                </div>
                            </div>
                            {/* Tags Section */}
                            {game.tags && game.tags.length > 0 && (
                                <div className='mb-12'>
                                    <div className="flex flex-wrap gap-2">
                                        {game.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="bg-blue-600/30 border border-blue-500/50 px-4 py-2 rounded-lg text-blue-200 text-sm font-medium"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="bg-gray-900/80 backdrop-blur-lg rounded-xl p-12">
                                <h2 className="text-2xl font-bold text-white mb-4">About This Game</h2>
                                <p className="text-gray-300 text-lg leading-relaxed">{game.description}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Game Stats */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">Statistics</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-blue-400 mb-2">{(game.views || 0).toLocaleString()}</div>
                                    <div className="text-gray-200 text-sm">Total Views</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-400 mb-2">{(game.downloads || 0).toLocaleString()}</div>
                                    <div className="text-gray-200 text-sm">Downloads</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-yellow-400 mb-2">{(game.rating || 0).toFixed(1)}</div>
                                    <div className="text-gray-200 text-sm">Rating</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-purple-400 mb-2">{game.totalRatings || 0}</div>
                                    <div className="text-gray-200 text-sm">Ratings</div>
                                </div>
                            </div>
                        </div>

                        {/* Reviews Section */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-6">Reviews</h2>
                            {ownsGame && !hasRated && (
                                <div className="mb-6">
                                    <button
                                        onClick={() => setShowRatingModal(true)}
                                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                                    >
                                        Write a Review
                                    </button>
                                </div>
                            )}
                            {loadingReviews ? (
                                <div className="text-center text-gray-200 py-8">Loading reviews...</div>
                            ) : reviews.length === 0 ? (
                                <div className="text-center text-gray-200 py-8">No reviews yet. Be the first to review!</div>
                            ) : (
                                <div className="space-y-6">
                                    {reviews.map((reviewItem) => (
                                        <div key={reviewItem.id} className="bg-white/5 rounded-lg p-6 border border-white/10">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                                        {reviewItem.user?.username?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-semibold">{reviewItem.user?.username || 'Anonymous'}</div>
                                                        <div className="text-gray-400 text-sm">{new Date(reviewItem.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <span
                                                            key={i}
                                                            className={`text-lg ${i < reviewItem.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                                                        >
                                                            ★
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-gray-300 leading-relaxed">{reviewItem.review}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Sidebar Ad */}
                        <AdBanner position="sidebar" />

                        {/* Play/Purchase Button Card */}
                        <div className="bg-gray-900/80 backdrop-blur-lg rounded-xl p-8 border border-blue-400/80 sticky top-24">

                            {checkingOwnership ? (
                                <div className="text-center text-gray-400 py-4">Checking...</div>
                            ) : ownsGame ? (
                                <>
                                    <div className="mb-4 p-3 bg-green-600/20 border border-green-500/50 rounded-lg text-center">
                                        <span className="text-green-400 font-semibold">You own this game</span>
                                    </div>
                                    <div className="space-y-3">
                                        <button
                                            onClick={handlePlay}
                                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-center py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                                        >
                                            Play Now
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-center py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                                        >
                                            Download Game
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-14 text-center">
                                        <div className="text-3xl font-bold text-white mb-1">€{game.price.toFixed(2)}</div>
                                        <div className="text-gray-200 text-sm">One-time purchase</div>
                                    </div>
                                    {user ? (
                                        <Link
                                            href={`/games/${params.id}/purchase`}
                                            className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-center py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                                        >
                                            Buy Now
                                        </Link>
                                    ) : (
                                        <Link
                                            href="/login"
                                            className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-center py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
                                        >
                                            Login to Purchase
                                        </Link>
                                    )}
                                </>
                            )}

                            {game.publishedAt && (
                                <div className="mt-4 text-center text-gray-200 text-sm">
                                    Published: {new Date(game.publishedAt).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Download Modal */}
            {showDownloadModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-md w-full">
                        <div className="text-center">
                            {downloadStatus === 'starting' ? (
                                <>
                                    <div className="mb-6">
                                        <div className="relative w-24 h-24 mx-auto">
                                            {/* Download animation - arrow moving down */}
                                            <svg className="w-24 h-24 text-blue-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            {/* Progress circle */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Downloading...</h3>
                                    <p className="text-gray-400">Preparing your download file...</p>
                                </>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-green-400 mb-2">Download Complete!</h3>
                                    <p className="text-gray-400">Your game has been downloaded successfully.</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Modal */}
            {showRatingModal && game && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRatingModal(false)}>
                    <div className="bg-gray-900 rounded-xl border border-white/20 p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-white mb-2 text-center">Rate {game.title}</h3>
                        <p className="text-gray-400 text-center mb-6">How would you rate this game?</p>

                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`text-4xl transition-all ${star <= rating
                                        ? 'text-yellow-400 scale-110'
                                        : 'text-gray-600 hover:text-yellow-300'
                                        }`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>

                        <div className="mb-6">
                            <label className="block text-white font-semibold mb-2">Your Review</label>
                            <textarea
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                placeholder="Share your thoughts about this game..."
                                className="w-full bg-gray-800 text-white rounded-lg p-4 border border-white/20 focus:border-blue-500 focus:outline-none resize-none"
                                rows={5}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setShowRatingModal(false);
                                    setRating(0);
                                    setReview('');
                                }}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRatingSubmit}
                                disabled={rating === 0 || !review.trim()}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Submit Review
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

