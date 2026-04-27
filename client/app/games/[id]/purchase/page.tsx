'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import env from '@/config/variables';
import { getAxiosErrorMessage } from '@/lib/errors';

interface Game {
    id: string;
    title: string;
    price: number;
    imageUrl?: string;
}

export default function PurchasePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [formData, setFormData] = useState({
        cardNumber: '',
        cardExpiry: '',
        cardCvc: '',
        cardName: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        if (params.id) {
            fetchGame();
        }
    }, [params.id, user, router]);

    const fetchGame = async () => {
        try {
            const response = await api.get(`/games/${params.id}`);
            setGame(response.data.game);
        } catch (error) {
            console.error('Failed to fetch game:', error);
            router.push('/games');
        } finally {
            setLoading(false);
        }
    };

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return v;
        }
    };

    const formatExpiry = (value: string) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + ' / ' + v.substring(2, 4);
        }
        return v;
    };

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCardNumber(e.target.value);
        setFormData({ ...formData, cardNumber: formatted });
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatExpiry(e.target.value);
        setFormData({ ...formData, cardExpiry: formatted });
    };

    const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        setFormData({ ...formData, cardCvc: v.substring(0, 3) });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        setProcessing(true);

        // Basic validation
        if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
            setErrors({ cardNumber: 'Please enter a valid card number' });
            setProcessing(false);
            return;
        }
        if (!formData.cardExpiry || formData.cardExpiry.length < 7) {
            setErrors({ cardExpiry: 'Please enter a valid expiry date' });
            setProcessing(false);
            return;
        }
        if (!formData.cardCvc || formData.cardCvc.length < 3) {
            setErrors({ cardCvc: 'Please enter a valid CVC' });
            setProcessing(false);
            return;
        }
        if (!formData.cardName) {
            setErrors({ cardName: 'Please enter the cardholder name' });
            setProcessing(false);
            return;
        }

        try {
            // Store payment data temporarily in sessionStorage (more secure than URL params)
            const paymentData = {
                gameId: params.id as string,
                cardNumber: formData.cardNumber.replace(/\s/g, ''),
                cardExpiry: formData.cardExpiry.replace(/\s/g, ''),
                cardCvc: formData.cardCvc,
                cardName: formData.cardName
            };
            
            sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
            
            // Redirect to processing page
            router.push(`/games/${params.id}/purchase/processing`);
        } catch (error: unknown) {
            setErrors({ general: getAxiosErrorMessage(error, 'Purchase failed. Please try again.') });
            setProcessing(false);
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
            
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
                        <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
                        <p className="text-blue-100">Secure payment powered by our payment system</p>
                    </div>

                    <div className="p-8">
                        {/* Order Summary */}
                        <div className="mb-8 pb-8 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h2>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                    <img
                                        src={game.imageUrl || `${env.API_URL}/games/${game.id}/image`}
                                        alt={game.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800">{game.title}</h3>
                                    <p className="text-gray-600 text-sm">Digital Game</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-gray-800">€{game.price.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {errors.general && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                    {errors.general}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Card Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.cardNumber}
                                    onChange={handleCardNumberChange}
                                    placeholder="1234 5678 9012 3456"
                                    maxLength={19}
                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.cardNumber ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {errors.cardNumber && (
                                    <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Expiry Date
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cardExpiry}
                                        onChange={handleExpiryChange}
                                        placeholder="MM / YY"
                                        maxLength={7}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            errors.cardExpiry ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.cardExpiry && (
                                        <p className="mt-1 text-sm text-red-600">{errors.cardExpiry}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        CVC
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cardCvc}
                                        onChange={handleCvcChange}
                                        placeholder="123"
                                        maxLength={3}
                                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            errors.cardCvc ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {errors.cardCvc && (
                                        <p className="mt-1 text-sm text-red-600">{errors.cardCvc}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cardholder Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.cardName}
                                    onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                                    placeholder="John Doe"
                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        errors.cardName ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {errors.cardName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.cardName}</p>
                                )}
                            </div>

                            {/* Total */}
                            <div className="pt-6 border-t border-gray-200">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-lg font-semibold text-gray-800">Total</span>
                                    <span className="text-2xl font-bold text-gray-800">€{game.price.toFixed(2)}</span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {processing ? 'Processing...' : `Pay €${game.price.toFixed(2)}`}
                                </button>
                            </div>

                            <p className="text-center text-sm text-gray-500">
                                Your payment information is secure and encrypted
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

