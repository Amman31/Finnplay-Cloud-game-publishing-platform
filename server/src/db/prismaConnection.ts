import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import env from '../config/variables';

let prisma: PrismaClient;

const getPrismaClient = (): PrismaClient => {
    if (!prisma) {
        if (!env.POSTGRESQL_URL) {
            throw new Error('POSTGRESQL_URL is not defined in environment variables');
        }

        // Create a PostgreSQL connection pool
        const pool = new Pool({
            connectionString: env.POSTGRESQL_URL,
        });

        // Create the adapter
        const adapter = new PrismaPg(pool);

        // Create PrismaClient with the adapter
        prisma = new PrismaClient({ adapter });
    }
    return prisma;
};

export const connectPrisma = async (): Promise<void> => {
    try {
        const client = getPrismaClient();
        await client.$connect();
        console.log('PostgreSQL connected successfully via Prisma');
    } catch (error) {
        console.error('PostgreSQL connection error:', error);
        process.exit(1);
    }
};

export default getPrismaClient;

