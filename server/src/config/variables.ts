import dotenv from 'dotenv';
dotenv.config();

const env = {
    PORT: process.env.PORT || '5000',
    POSTGRESQL_URL: process.env.POSTGRESQL_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://python-service:8000',
    AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || 'finnplay-images',
    /** Browser-facing blob base (e.g. http://127.0.0.1:10000). Set when BlobEndpoint uses a Docker-only hostname like http://azurite:10000 */
    AZURE_STORAGE_PUBLIC_ORIGIN: process.env.AZURE_STORAGE_PUBLIC_ORIGIN
}

export default env; 