'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import env from '@/config/variables';

interface Ad {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    linkUrl: string;
    impressions: number;
    clicks: number;
}

interface GameAdCardProps {
    className?: string;
}

export default function GameAdCard({ className = '' }: GameAdCardProps) {
    const [ad, setAd] = useState<Ad | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAd();
    }, []);

    const fetchAd = async () => {
        try {
            // Fetch banner ads to use in the grid
            const response = await api.get('/ads?position=banner&active=true');
            const ads = response.data.ads || [];
            if (ads.length > 0) {
                // Randomly select an ad if multiple exist
                const randomAd = ads[Math.floor(Math.random() * ads.length)];
                setAd(randomAd);
            }
        } catch (error) {
            // Silently fail if ads can't be loaded
            console.error('Failed to fetch ad:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!ad) return;
        try {
            await api.post(`/ads/${ad.id}/click`);
            window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('Failed to track ad click:', error);
            window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
        }
    };

    if (loading || !ad) {
        return null;
    }

    const adImageUrl = ad.imageUrl || `${env.API_URL}/ads/${ad.id}/image`;

    return (
        <div
            onClick={handleAdClick}
            className={`bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden shadow-lg hover:scale-105 transition-transform border border-white/20 flex flex-col cursor-pointer group relative ${className}`}
        >
            {/* Ad Badge */}
            <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                AD
            </div>

            <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center relative overflow-hidden">
                <img
                    src={adImageUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        console.error('Ad image failed to load:', adImageUrl, target.src);
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.error-message')) {
                            const errorMsg = document.createElement('span');
                            errorMsg.className = 'error-message text-gray-400';
                            errorMsg.textContent = 'No Image';
                            parent.appendChild(errorMsg);
                        }
                    }}
                    onLoad={() => {
                        console.log('Ad image loaded successfully:', adImageUrl);
                    }}
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white font-bold text-sm mb-1 line-clamp-1">{ad.title}</h3>
                        {ad.description && (
                            <p className="text-white/90 text-xs line-clamp-2">{ad.description}</p>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-3 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-white mb-1 line-clamp-2">{ad.title}</h3>
                {ad.description && (
                    <p className="text-gray-300 text-xs mb-2 line-clamp-2 flex-1">{ad.description}</p>
                )}
                <div className="mt-auto pt-2">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 px-4 rounded-lg text-sm font-semibold group-hover:from-blue-700 group-hover:to-purple-700 transition">
                        Learn More
                    </div>
                </div>
            </div>
        </div>
    );
}

