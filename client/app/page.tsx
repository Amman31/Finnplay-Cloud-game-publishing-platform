'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function HomePage() {
    return (
        <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col">
            <Navbar />

            <div className="flex-1 flex items-center justify-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-white mb-4">
                            Welcome to FinnPlay
                        </h1>
                        <p className="text-xl text-gray-300 mb-8">
                            Discover and play amazing games from Finnish developers
                        </p>
                        <Link
                            href="/games"
                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition"
                        >
                            View All Games
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
