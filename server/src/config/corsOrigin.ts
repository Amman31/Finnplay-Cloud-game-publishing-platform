import type { CorsOptions } from 'cors';
import env from './variables';

const isLocalDevOrigin = (origin: string): boolean =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

/**
 * Browsers treat http://localhost:3000 and http://127.0.0.1:3000 as different
 * origins. FRONTEND_URL must match how you open the site, or CORS blocks the API.
 * In development we allow both loopback hostnames on any port.
 */
export const corsOptions: CorsOptions = {
    credentials: true,
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }
        const primary = env.FRONTEND_URL;
        if (primary && origin === primary) {
            callback(null, true);
            return;
        }
        if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    }
};
