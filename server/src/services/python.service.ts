import env from '../config/variables';

const fetchPythonService = async (path: string) => {
    const response = await fetch(`${env.PYTHON_SERVICE_URL}${path}`);
    if (!response.ok) {
        let detail = '';
        try {
            detail = (await response.text()).slice(0, 500);
        } catch {
            /* ignore */
        }
        throw new Error(
            `Python service request failed (${response.status}) ${path}${detail ? `: ${detail}` : ''}`
        );
    }
    return response.json();
};

export const getPythonRecommendations = async (userId: string) => {
    return fetchPythonService(`/recommendations/${userId}`);
};

export const getPythonTrending = async () => {
    return fetchPythonService('/analytics/trending');
};

export const getPythonAnalyticsDashboard = async () => {
    return fetchPythonService('/analytics/dashboard');
};

export const getPythonRevenueBreakdown = async () => {
    return fetchPythonService('/analytics/revenue-breakdown');
};
