import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import * as mediasoup from '../mediasoup/mediasoup.js';
import logger from '../logger.js';
import type { ConnectTransportData, ConsumeData, CreateTransportData, ResumeData } from '../types/data-types.js';

const log = logger('Socket');

export async function setupSocketIO(httpServer: Server) {
    const io = new SocketIOServer(httpServer, {
        serveClient: false,
        path: '/server',
    });
    io.on('connection', (socket) => {

        log.info('user connected to socket.io');
        socket.on('disconnect', () => {
            log.info('user disconnected from socket.io');
        });

        socket.on('connect_error', (err) => {
            log.error('client connection error', err);
        });

        socket.on('getRouterRtpCapabilities', async (data, callback) => {
            const mediasoupRouter = await mediasoup.getRouter();
            callback(mediasoupRouter.rtpCapabilities);
        });

        socket.on('createProducerTransport', async (data: CreateTransportData, callback) => {
            try {
                const { transport, params } = await mediasoup.createWebRtcTransport(data.kind, 'producer');
                callback(params);
            } catch (err: any) {
                log.error(err);
                callback({ error: err.message });
            }
        });

        socket.on('connectProducerTransport', async (data: ConnectTransportData, callback) => {
            await mediasoup.connectWebRtcTransport(data.kind, 'producer', { dtlsParameters: data.dtlsParameters });
            callback();
        });

        socket.on('produce', async (data, callback) => {
            const producer = await mediasoup.produce(data);
            callback({ id: producer.id });
            socket.broadcast.emit('newProducer');
        });

        socket.on('createConsumerTransport', async (data: CreateTransportData, callback) => {
            try {
                const { transport, params } = await mediasoup.createWebRtcTransport(data.kind, 'consumer');
                callback(params);
            } catch (err: any) {
                log.error(err);
                callback({ error: err.message });
            }
        });

        socket.on('connectConsumerTransport', async (data: ConnectTransportData, callback) => {
            await mediasoup.connectWebRtcTransport(data.kind, 'consumer', { dtlsParameters: data.dtlsParameters });
            callback();
        });

        socket.on('consume', async (data: ConsumeData, callback) => {
            const { consumer, params } = await mediasoup.consume(data);
            callback(params);
        });

        socket.on('resume', async (data: ResumeData, callback) => {
            const consumer = await mediasoup.resume(data);
            callback();
        });

        if (mediasoup.isProducer()) {
            socket.emit('newProducer');
        }
    });
    log.info('Socket.IO setup complete');
    return io;
}
