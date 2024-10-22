import express from 'express';
import { createServer, Server } from 'http';
import path from 'path';
import { __dirname } from '../dirname.js';
import logger from '../logger.js';

const log = logger('Express');

export async function setupExpress(): Promise<Server> {
    const app = express();
    app.use(express.static(path.resolve(__dirname, '..', 'public')));
    log.info('Express setup complete');
    const httpServer = createServer(app);
    log.info('HTTP server setup complete');
    return httpServer;
}