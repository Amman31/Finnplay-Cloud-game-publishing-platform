'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import api from '@/lib/api';

interface User {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin' | 'ADMIN';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = Cookies.get('token');
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data.user);
        } catch (error) {
            Cookies.remove('token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        Cookies.set('token', response.data.token, { expires: 7 });
        setUser(response.data.user);
    };

    const register = async (username: string, email: string, password: string) => {
        const response = await api.post('/auth/register', { username, email, password });
        if (response.data.token && response.data.user) {
            Cookies.set('token', response.data.token, { expires: 7 });
            setUser(response.data.user);
        } else {
            throw new Error('Registration failed: Invalid response from server');
        }
    };

    const logout = () => {
        Cookies.remove('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
                isAdmin: user?.role?.toLowerCase() === 'admin',
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

