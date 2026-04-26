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
    position: 'banner' | 'sidebar' | 'popup' | 'in-game';
    impressions: number;
    clicks: number;
}

interface AdBannerProps {
    position: 'banner' | 'sidebar' | 'popup' | 'in-game';
    className?: string;
}

export default function AdBanner({ position, className = '' }: AdBannerProps) {
    const [ad, setAd] = useState<Ad | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (position === 'popup') {
            setLoading(false);
            return;
        }
        fetchAd();
    }, [position]);

    const fetchAd = async () => {
        try {
            const response = await api.get(`/ads?position=${position}&active=true`);
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

    const handleAdClick = async () => {
        if (!ad) return;
        try {
            await api.post(`/ads/${ad.id}/click`);
            window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('Failed to track ad click:', error);
            window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
        }
    };

    if (loading) {
        return null;
    }

    if (!ad) {
        return null;
    }

    const adImageUrl = ad.imageUrl || `${env.API_URL}/ads/${ad.id}/image`;

    if (position === 'banner') {
        return (
            <div className={`w-full mb-6 ${className}`}>
                <div
                    onClick={handleAdClick}
                    className="relative w-full rounded-xl overflow-hidden shadow-2xl cursor-pointer group hover:scale-[1.02] transition-transform"
                >
                    <img
                        src={adImageUrl}
                        alt={ad.title}
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-4 left-4 right-4">
                            <h3 className="text-white font-bold text-lg mb-1">{ad.title}</h3>
                            {ad.description && (
                                <p className="text-white/90 text-sm line-clamp-2">{ad.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Ad
                    </div>
                </div>
            </div>
        );
    }

    if (position === 'sidebar') {
        return (
            <div className={`w-full ${className}`}>
                <div
                    onClick={handleAdClick}
                    className="relative rounded-xl overflow-hidden shadow-xl cursor-pointer group hover:scale-[1.02] transition-transform border border-white/20"
                >
                    <img
                        src={adImageUrl}
                        alt={ad.title}
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="text-white font-semibold text-sm mb-1">{ad.title}</h3>
                            {ad.description && (
                                <p className="text-white/80 text-xs line-clamp-1">{ad.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Ad
                    </div>
                </div>
            </div>
        );
    }

    /* Popup placement is handled globally by <GlobalAdPopup /> (active ads with position=popup). */
    if (position === 'popup') return null;

    return null;
}

