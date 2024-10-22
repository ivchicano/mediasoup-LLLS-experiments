import type { RouterOptions, WorkerSettings, TransportListenInfo } from 'mediasoup/node/lib/types.js';

export interface Config {
    listenIp: string;
    listenPort: number;
    sslCrt: string;
    sslKey: string;
    mediasoup: MediasoupConfig;
}

export interface MediasoupConfig {
    worker: WorkerSettings;
    router: RouterOptions;
    webRtcTransport: WebRtcTransportConfig;
}

export interface WebRtcTransportConfig {
    listenInfos: TransportListenInfo[];
    maxIncomingBitrate?: number;
    initialAvailableOutgoingBitrate?: number;
}