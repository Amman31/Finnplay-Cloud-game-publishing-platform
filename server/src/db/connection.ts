import { connectPrisma } from './prismaConnection';

const connectDB = async (): Promise<void> => {
    try {
        await connectPrisma();
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

export default connectDB;

