'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import api from '@/lib/api';

interface Ad {
    id: string;
    title: string;
    description: string;
    position: string;
    active: boolean;
    impressions: number;
    clicks: number;
}

export default function AdsPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const [ads, setAds] = useState<Ad[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchAds();
        }
    }, [isAdmin]);

    const fetchAds = async () => {
        try {
            const response = await api.get('/ads');
            setAds(response.data.ads || []);
        } catch (error) {
            console.error('Failed to fetch ads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this ad?')) return;
        
        try {
            await api.delete(`/ads/${id}`);
            fetchAds();
        } catch (error) {
            console.error('Failed to delete ad:', error);
            alert('Failed to delete ad');
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await api.patch(`/ads/${id}`, { active: !currentStatus });
            fetchAds();
        } catch (error) {
            console.error('Failed to update ad:', error);
            alert('Failed to update ad');
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
                    <h1 className="text-4xl font-bold text-white">Manage Ads</h1>
                    <Link
                        href="/admin/ads/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                    >
                        Create New Ad
                    </Link>
                </div>

                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                    <div className="overflow-x-auto">
                        <table className="w-full text-white">
                            <thead>
                                <tr className="border-b border-white/20">
                                    <th className="text-left p-4">Title</th>
                                    <th className="text-left p-4">Position</th>
                                    <th className="text-left p-4">Status</th>
                                    <th className="text-left p-4">Impressions</th>
                                    <th className="text-left p-4">Clicks</th>
                                    <th className="text-left p-4">CTR</th>
                                    <th className="text-left p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ads.map((ad) => (
                                    <tr key={ad.id} className="border-b border-white/10">
                                        <td className="p-4">{ad.title}</td>
                                        <td className="p-4">{ad.position}</td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => toggleActive(ad.id, ad.active)}
                                                className={`px-2 py-1 rounded ${ad.active ? 'bg-green-600' : 'bg-gray-600'}`}
                                            >
                                                {ad.active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="p-4">{ad.impressions}</td>
                                        <td className="p-4">{ad.clicks}</td>
                                        <td className="p-4">
                                            {ad.impressions > 0
                                                ? ((ad.clicks / ad.impressions) * 100).toFixed(2) + '%'
                                                : '0%'}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleDelete(ad.id)}
                                                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

