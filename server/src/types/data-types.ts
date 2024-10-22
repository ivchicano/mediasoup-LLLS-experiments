import type { MediaKind, RtpCapabilities } from "mediasoup/node/lib/RtpParameters.js";
import type { DtlsParameters } from "mediasoup/node/lib/types.js";

export type CreateTransportData = {
    kind: MediaKind;
}

export type ConnectTransportData = {
    kind: MediaKind;
    dtlsParameters: DtlsParameters;
}

export type ConsumeData = {
    kind: MediaKind;
    rtpCapabilities: RtpCapabilities;
}

export type ResumeData = {
    kind: MediaKind;
}