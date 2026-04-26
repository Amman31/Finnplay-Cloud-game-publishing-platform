import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/variables';

const getContainerClient = () => {
    if (!env.AZURE_STORAGE_CONNECTION_STRING) {
        throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
    }
    const cs = env.AZURE_STORAGE_CONNECTION_STRING;
    // Pipeline options no longer accept serviceVersion here (see @azure/storage-blob StoragePipelineOptions).
    // Azurite in dev/local Docker uses `--skipApiVersionCheck`; real Azure accepts the SDK default API version.
    const blobServiceClient = BlobServiceClient.fromConnectionString(cs);
    return blobServiceClient.getContainerClient(env.AZURE_STORAGE_CONTAINER_NAME);
};

const sanitizeFileExtension = (mimetype: string): string => {
    const extension = mimetype.split('/')[1] || 'bin';
    return extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
};

/**
 * URL stored in DB / returned to browsers. Server may use Docker-only hostnames (e.g. azurite) in the connection string.
 */
export const publicStorageUrl = (url: string | null | undefined): string | null | undefined => {
    if (url == null || url === '') return url;
    try {
        const u = new URL(url);
        const origin = env.AZURE_STORAGE_PUBLIC_ORIGIN?.trim();
        if (origin) {
            const pub = new URL(origin.endsWith('/') ? origin.slice(0, -1) : origin);
            u.protocol = pub.protocol;
            u.host = pub.host;
            return u.toString();
        }
        if (u.hostname === 'azurite') {
            u.protocol = 'http:';
            u.hostname = '127.0.0.1';
            if (!u.port) u.port = '10000';
            return u.toString();
        }
        return url;
    } catch {
        return url;
    }
};

export const uploadImageBuffer = async (buffer: Buffer, mimetype: string, folder: 'games' | 'ads'): Promise<string> => {
    const containerClient = getContainerClient();
    await containerClient.createIfNotExists({ access: 'blob' });

    const extension = sanitizeFileExtension(mimetype);
    const blobName = `${folder}/${uuidv4()}.${extension}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
            blobContentType: mimetype
        }
    });

    return publicStorageUrl(blockBlobClient.url) as string;
};

export const deleteImageByUrl = async (url?: string | null): Promise<void> => {
    if (!url) return;
    if (!env.AZURE_STORAGE_CONNECTION_STRING) return;

    const containerClient = getContainerClient();
    const containerName = env.AZURE_STORAGE_CONTAINER_NAME;
    const marker = `/${containerName}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;

    const blobName = url.slice(idx + marker.length).split('?')[0];
    await containerClient.deleteBlob(blobName, { deleteSnapshots: 'include' }).catch(() => undefined);
};
