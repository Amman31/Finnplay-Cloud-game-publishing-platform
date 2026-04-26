import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import client from 'prom-client';
import connectDB from './db/connection';
import { corsOptions } from './config/corsOrigin';
import apiRoutes from './routes/apiRoutes';

const app = express();

// Connect to PostgreSQL
connectDB();

client.collectDefaultMetrics({ prefix: 'finnplay_node_' });

// Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors(corsOptions));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

export default app;
