'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAxiosErrorMessage } from '@/lib/errors';

interface PaymentSessionData {
    gameId: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
    cardName: string;
}

export default function PaymentProcessingPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [status, setStatus] = useState<'processing' | 'completing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }

        // Get payment data from sessionStorage
        const paymentDataStr = sessionStorage.getItem('paymentData');
        if (!paymentDataStr) {
            setStatus('error');
            setErrorMessage('Payment data not found. Please try again.');
            setTimeout(() => {
                router.push(`/games/${params.id}/purchase`);
            }, 3000);
            return;
        }

        const paymentData = JSON.parse(paymentDataStr) as PaymentSessionData;
        
        // Clear payment data from sessionStorage
        sessionStorage.removeItem('paymentData');

        processPayment(paymentData);
    }, [params.id, user, router]);

    const processPayment = async (paymentData: PaymentSessionData) => {
        const gameId = paymentData.gameId;
        
        try {
            // Step 1: Processing payment
            setStatus('processing');
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate payment processing

            // Step 2: Get game details to get the price
            const gameResponse = await api.get(`/games/${gameId}`);
            const game = gameResponse.data.game;

            // Step 3: Completing purchase
            setStatus('completing');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate purchase completion

            // Step 4: Make actual API call with purchase data
            await api.post('/purchases', {
                gameId: gameId,
                amount: game.price,
                currency: 'EUR',
                paymentMethod: 'card',
                status: 'completed'
            });

            // Step 5: Success - redirect to game page
            setStatus('success');
            await new Promise(resolve => setTimeout(resolve, 1000));
            router.push(`/games/${gameId}?purchased=true`);
        } catch (error: unknown) {
            console.error('Payment processing error:', error);
            setStatus('error');
            setErrorMessage(getAxiosErrorMessage(error, 'Payment failed. Please try again.'));
            
            // Redirect back to purchase page after 3 seconds
            setTimeout(() => {
                router.push(`/games/${gameId}/purchase`);
            }, 3000);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <Navbar />
            
            <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
                <div className="max-w-md w-full mx-4">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
                        {status === 'processing' && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Processing Payment</h2>
                                <p className="text-gray-300">Please wait while we process your payment...</p>
                            </>
                        )}

                        {status === 'completing' && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Completing Purchase</h2>
                                <p className="text-gray-300">Finalizing your purchase...</p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Purchase Successful!</h2>
                                <p className="text-gray-300">Redirecting to your game...</p>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto">
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
                                <p className="text-red-300 mb-4">{errorMessage}</p>
                                <p className="text-gray-400 text-sm">Redirecting back to purchase page...</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

