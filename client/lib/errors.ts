import axios from 'axios';

function messageFromResponseData(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const o = data as Record<string, unknown>;
    for (const key of ['message', 'error'] as const) {
        const v = o[key];
        if (typeof v === 'string') return v;
    }
    return undefined;
}

/** Safe message for UI from axios or thrown values */
export function getAxiosErrorMessage(err: unknown, fallback = 'Request failed'): string {
    if (axios.isAxiosError(err)) {
        const fromData = messageFromResponseData(err.response?.data);
        if (fromData) return fromData;
        if (err.message) return err.message;
    }
    if (err instanceof Error) return err.message;
    return fallback;
}
