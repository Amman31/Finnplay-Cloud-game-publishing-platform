'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function NewAdPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        linkUrl: '',
        position: 'popup' as 'popup' | 'banner' | 'sidebar',
        startDate: '',
        endDate: ''
    });
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!image) {
            setError('Please upload an image');
            setLoading(false);
            return;
        }

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('linkUrl', formData.linkUrl);
            formDataToSend.append('position', formData.position);
            if (formData.startDate) formDataToSend.append('startDate', formData.startDate);
            if (formData.endDate) formDataToSend.append('endDate', formData.endDate);
            formDataToSend.append('image', image);

            await api.post('/ads', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            router.push('/admin/ads');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create ad');
        } finally {
            setLoading(false);
        }
    };

    if (!isAdmin) {
        router.push('/');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />
            
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-4xl font-bold text-white mb-8">Create New Ad</h1>

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
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Link URL *
                            </label>
                            <input
                                type="url"
                                value={formData.linkUrl}
                                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Placement *
                            </label>
                            <select
                                value={formData.position}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        position: e.target.value as 'popup' | 'banner' | 'sidebar'
                                    })
                                }
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="popup" className="bg-gray-800 text-white">
                                    Site popup — full-screen overlay on first visit (per browser tab)
                                </option>
                                <option value="banner" className="bg-gray-800 text-white">
                                    Banner — wide strip where banners are shown
                                </option>
                                <option value="sidebar" className="bg-gray-800 text-white">
                                    Sidebar — game detail sidebar
                                </option>
                            </select>
                            <p className="mt-2 text-xs text-gray-400">
                                Popup ads rotate in one overlay; visitors close it with the × button. Shown once per tab
                                until they close it (session).
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-200 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-200 mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-200 mb-2">
                                Ad Image * (max 10MB)
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImage(e.target.files?.[0] || null)}
                                required
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create Ad'}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.back()}
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

