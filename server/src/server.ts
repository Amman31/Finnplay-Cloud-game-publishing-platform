import server from './app';
import env from './config/variables'

const PORT = env.PORT || '5000';

const startServer = () => {
    try {
        const portNumber = parseInt(PORT, 10);
        server.listen(portNumber, () => {
            console.log(`Server is running on http://localhost:${portNumber}`);
        });

    } catch (err) {
        console.error('Unexpected error during server startup:', err);
        process.exit(1);
    }
};

startServer();
