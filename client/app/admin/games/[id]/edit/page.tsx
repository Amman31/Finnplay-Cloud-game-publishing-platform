'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/errors';

export default function EditGamePage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.id as string;
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        gameUrl: '',
        tags: '',
        price: ''
    });
    const [image, setImage] = useState<File | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin && gameId) {
            fetchGame();
        }
    }, [isAdmin, gameId]);

    const fetchGame = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/games/${gameId}`);
            const game = response.data.game;
            
            setFormData({
                title: game.title || '',
                description: game.description || '',
                category: game.category || '',
                gameUrl: game.gameUrl || '',
                tags: Array.isArray(game.tags) ? game.tags.join(', ') : (game.tags || ''),
                price: game.price?.toString() || '0'
            });
            
            // Set existing image URL if available
            if (game.imageUrl) {
                setExistingImageUrl(game.imageUrl);
            }
        } catch (error) {
            console.error('Failed to fetch game:', error);
            setError('Failed to load game data');
            router.push('/admin/games');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('category', formData.category);
            formDataToSend.append('gameUrl', formData.gameUrl);
            formDataToSend.append('price', formData.price || '0');
            if (formData.tags) {
                formDataToSend.append('tags', JSON.stringify(formData.tags.split(',').map(t => t.trim())));
            }
            // Only append image if a new one was selected
            if (image) {
                formDataToSend.append('image', image);
            }

            await api.patch(`/games/${gameId}`, formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            router.push('/admin/games');
        } catch (err: unknown) {
            setError(getAxiosErrorMessage(err, 'Failed to update game'));
        } finally {
            setSaving(false);
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

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-4xl font-bold text-white mb-8">Edit Game</h1>

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
                    {error && (
                        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Description *
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                                rows={5}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Category *
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="">Select category</option>
                                <option value="action">Action</option>
                                <option value="adventure">Adventure</option>
                                <option value="puzzle">Puzzle</option>
                                <option value="strategy">Strategy</option>
                                <option value="sports">Sports</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Game URL *
                            </label>
                            <input
                                type="url"
                                value={formData.gameUrl}
                                onChange={(e) => setFormData({ ...formData, gameUrl: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://example.com/game"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Price (EUR) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="29.99"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Tags (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="tag1, tag2, tag3"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Game Image (leave empty to keep current image)
                            </label>
                            {existingImageUrl && (
                                <div className="mb-3">
                                    <p className="text-gray-300 text-sm mb-2">Current image:</p>
                                    <img 
                                        src={existingImageUrl} 
                                        alt="Current game" 
                                        className="w-32 h-32 object-cover rounded-lg border border-white/20"
                                    />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImage(e.target.files?.[0] || null)}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                            />
                            <p className="text-gray-400 text-xs mt-1">Upload a new image to replace the current one (max 10MB)</p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/admin/games')}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

