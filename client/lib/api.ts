import axios from 'axios';
import Cookies from 'js-cookie';
import env from '@/config/variables';

const API_URL = env.API_URL;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData (multipart/form-data)
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    return config;
});

// Handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            Cookies.remove('token');
            const reqUrl = String(error.config?.url || '');
            if (typeof window !== 'undefined' && !reqUrl.includes('/auth/me')) {
                const path = window.location.pathname;
                if (path !== '/login' && path !== '/register') {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;

