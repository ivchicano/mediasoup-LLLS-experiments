import * as mediasoup from 'mediasoup';
import config from '../config.js';
import logger from '../logger.js';
import type { MediaKind } from 'mediasoup/node/lib/types.js';
import type { ConsumeData, ResumeData } from '../types/data-types.js';

let mediasoupWorker: mediasoup.types.Worker;
let mediasoupRouter: mediasoup.types.Router;
let videoProducerTransport: mediasoup.types.WebRtcTransport;
let audioProducerTransport: mediasoup.types.WebRtcTransport;
let videoConsumerTransport: mediasoup.types.WebRtcTransport;
let audioConsumerTransport: mediasoup.types.WebRtcTransport;
let videoProducer: mediasoup.types.Producer;
let audioProducer: mediasoup.types.Producer;
let videoConsumer: mediasoup.types.Consumer;
let audioConsumer: mediasoup.types.Consumer;
const log = logger('Mediasoup');

export async function setupMediasoupWorker() {
    const worker = await mediasoup.createWorker(config.mediasoup.worker);
    worker.on('died', () => {
        log.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
    });
    log.info('mediasoup worker created [pid:%d]', worker.pid);
    mediasoupWorker = worker;
    return worker;
}

export async function getRouter() {
    if (!mediasoupRouter) {
        log.info('Creating router');
        mediasoupRouter = await mediasoupWorker.createRouter(config.mediasoup.router);
        log.info('Router created');
    }
    return mediasoupRouter;
}

export async function createWebRtcTransport(mediaKind: MediaKind, transportType: 'producer' | 'consumer') {
    log.info('Creating %s WebRTC %s transport', transportType, mediaKind);
    const {
        maxIncomingBitrate,
        initialAvailableOutgoingBitrate
    } = config.mediasoup.webRtcTransport;

    const transport = await mediasoupRouter.createWebRtcTransport({
        listenInfos: config.mediasoup.webRtcTransport.listenInfos,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
    });
    if (maxIncomingBitrate) {
        try {
            await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {
            log.warn(error);
        }
    }
    switch (transportType) {
        case 'producer':
            if (mediaKind === 'video') {
                videoProducerTransport = transport;
            } else {
                audioProducerTransport = transport;
            }
            break;
        case 'consumer':
            if (mediaKind === 'video') {
                videoConsumerTransport = transport;
            } else {
                audioConsumerTransport = transport;
            }
            break;
    }
    log.info('%s WebRTC %s transport created', transportType, mediaKind);
    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        },
    };
}

export async function connectWebRtcTransport(mediaKind: MediaKind, transportType: 'producer' | 'consumer', data: any) {
    let transport;
    if (transportType === 'producer') {
        transport = mediaKind === 'video' ? videoProducerTransport : audioProducerTransport;
    } else {
        transport = mediaKind === 'video' ? videoConsumerTransport : audioConsumerTransport;
    }
    log.info('Connecting %s WebRTC %s transport', transportType, mediaKind);
    await transport.connect({ dtlsParameters: data.dtlsParameters });
    log.info('%s WebRTC %s transport connected', transportType, mediaKind);
}

export async function produce(data: any) {
    const { kind, rtpParameters } = data;
    log.info('Producing %s', kind);
    const transport = kind === 'video' ? videoProducerTransport : audioProducerTransport;
    const producer = await transport.produce({ kind, rtpParameters });
    if (kind === 'video') videoProducer = producer;
    else audioProducer = producer;
    log.info('%s produced', kind);
    return producer;
}

export async function consume(data: ConsumeData): Promise<{ consumer: mediasoup.types.Consumer, params: any }> {
    const { kind, rtpCapabilities } = data;
    const producerId = kind === 'video' ? videoProducer.id : audioProducer.id;
    log.info('Consuming %s', kind);
    if (!mediasoupRouter.canConsume({ producerId, rtpCapabilities })) {
        log.error('Can not consume %s', kind);
        throw new Error('Can not consume');
    }
    const transport = kind === 'video' ? videoConsumerTransport : audioConsumerTransport;
    let consumer;
    try {
        consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: kind === 'video',
        });
    } catch (error) {
        log.error('Error consuming %s: %s', kind, error);
        throw error;
    }
    if (kind === 'video') {
        videoConsumer = consumer;
        if ('type' in videoConsumer && videoConsumer.type === 'simulcast') {
            await videoConsumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
        }
    }
    else {
        audioConsumer = consumer;
    }
    log.info('%s consumed', kind);
    return {
        consumer,
        params: {
            producerId: producerId,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
        },
    };
}

export async function resume(data: ResumeData) {
    const { kind } = data;
    log.info('Resuming %s', kind);
    const consumer = kind === 'video' ? videoConsumer : audioConsumer;
    await consumer.resume();
    log.info('%s resumed', kind);
}

export function isProducer() {
    return videoProducerTransport && audioProducerTransport;
}