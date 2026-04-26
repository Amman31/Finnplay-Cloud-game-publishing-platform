'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';
import env from '@/config/variables';

const SESSION_DISMISS_KEY = 'finnplay-popup-ads-dismissed';

interface PopupAd {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    linkUrl: string;
}

export function GlobalAdPopup() {
    const pathname = usePathname();
    const [ads, setAds] = useState<PopupAd[]>([]);
    const [index, setIndex] = useState(0);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (pathname?.startsWith('/admin')) return;
        if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return;

        let cancelled = false;
        (async () => {
            try {
                let list: PopupAd[] = [];
                const popupRes = await api.get('/ads?position=popup&active=true');
                list = popupRes.data.ads || [];
                if (list.length === 0) {
                    const bannerRes = await api.get('/ads?position=banner&active=true');
                    list = bannerRes.data.ads || [];
                }
                if (cancelled || list.length === 0) return;
                setAds(list);
                setOpen(true);
            } catch {
                /* CORS, network, or API error — no overlay */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    const dismiss = useCallback(() => {
        sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
        setOpen(false);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss();
            if (e.key === 'ArrowLeft' && ads.length > 1) {
                setIndex((i) => (i - 1 + ads.length) % ads.length);
            }
            if (e.key === 'ArrowRight' && ads.length > 1) {
                setIndex((i) => (i + 1) % ads.length);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, ads.length, dismiss]);

    const goPrev = () => {
        if (ads.length < 2) return;
        setIndex((i) => (i - 1 + ads.length) % ads.length);
    };

    const goNext = () => {
        if (ads.length < 2) return;
        setIndex((i) => (i + 1) % ads.length);
    };

    const handleAdActivate = async (ad: PopupAd) => {
        try {
            await api.post(`/ads/${ad.id}/click`);
        } catch {
            /* still open sponsor link */
        }
        const url = ad.linkUrl?.trim();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (!open || ads.length === 0) return null;

    const ad = ads[index];
    const imageSrc = ad.imageUrl || `${env.API_URL}/ads/${ad.id}/image`;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finnplay-popup-ad-title"
            onClick={dismiss}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                }}
                className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white ring-1 ring-white/30 transition hover:bg-white/20"
                aria-label="Close promotions"
            >
                ×
            </button>

            <div
                className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-gray-900/95 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute left-3 top-3 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white/90">
                    Sponsored
                </div>

                {ads.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                goPrev();
                            }}
                            className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/70"
                            aria-label="Previous ad"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                goNext();
                            }}
                            className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/70"
                            aria-label="Next ad"
                        >
                            ›
                        </button>
                    </>
                )}

                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAdActivate(ad)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void handleAdActivate(ad);
                        }
                    }}
                    className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                >
                    <div className="relative aspect-[16/10] w-full bg-gray-800">
                        <img
                            src={imageSrc}
                            alt={ad.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                    <div className="p-5">
                        <h2 id="finnplay-popup-ad-title" className="text-xl font-bold text-white">
                            {ad.title}
                        </h2>
                        {ad.description ? (
                            <p className="mt-2 line-clamp-3 text-sm text-gray-300">{ad.description}</p>
                        ) : null}
                        <span className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
                            Visit sponsor
                        </span>
                    </div>
                </div>

                {ads.length > 1 && (
                    <div className="flex justify-center gap-2 pb-4">
                        {ads.map((_, i) => (
                            <button
                                key={ads[i].id}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIndex(i);
                                }}
                                className={`h-2 rounded-full transition ${i === index ? 'w-6 bg-blue-500' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                                aria-label={`Go to ad ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
