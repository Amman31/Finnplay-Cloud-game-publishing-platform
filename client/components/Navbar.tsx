'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const { user, logout, isAdmin } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <nav className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center space-x-8">
                        <Link href="/" className="text-2xl font-bold text-white hover:text-blue-400 transition">
                            FinnPlay
                        </Link>
                        <Link href="/games" className="text-gray-300 hover:text-white transition">
                            Games
                        </Link>
                        {isAdmin && (
                            <Link href="/admin" className="text-gray-300 hover:text-white transition">
                                Admin Panel
                            </Link>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                <Link
                                    href="/profile"
                                    className="text-gray-300 hover:text-white transition"
                                >
                                    Profile
                                </Link>
                                <span className="text-gray-300">Welcome, {user.username}</span>
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-gray-300 hover:text-white transition"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/register"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

