'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalAdPopup } from '@/components/GlobalAdPopup';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            {children}
            <Suspense fallback={null}>
                <GlobalAdPopup />
            </Suspense>
        </AuthProvider>
    );
}

