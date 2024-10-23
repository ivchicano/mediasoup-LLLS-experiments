import * as mediasoup from 'mediasoup-client';
import socketClient from 'socket.io-client';
import { promise as socketPromise } from './lib/socket.io-promise.js';

const STATS_INTERVAL = 5000;
const BLOB_INTERVAL = 5000;

let device;
let socket;
let videoProducer;
let audioProducer;
let videoConsumer;
let audioConsumer;
let producerStream;
let subscriberStream;
let producerRecorder;
let consumerRecorder;

const $ = document.querySelector.bind(document);
const $fsPublish = $('#fs_publish');
const $fsSubscribe = $('#fs_subscribe');
const $btnConnect = $('#btn_connect');
const $btnWebcam = $('#btn_webcam');
const $btnSubscribe = $('#btn_subscribe');
const $chkSimulcast = $('#chk_simulcast');
const $txtConnection = $('#connection_status');
const $txtSubscriptionVideo = $('#sub_status_video');
const $txtSubscriptionAudio = $('#sub_status_audio');
const $txtPublishVideo = $('#webcam_status_video');
const $txtPublishAudio = $('#webcam_status_audio');

$btnConnect.addEventListener('click', connect);
$btnWebcam.addEventListener('click', publish);
$btnSubscribe.addEventListener('click', subscribe);

async function connect() {
    $btnConnect.disabled = true;
    $txtConnection.innerHTML = 'Connecting...';

    const opts = {
        path: '/server',
        transports: ['websocket'],
    };


    const serverUrl = $('#server_url').value;
    socket = socketClient(serverUrl, opts);
    socket.request = socketPromise(socket);

    socket.on('connect', async () => {
        $txtConnection.innerHTML = 'Connected';
        $fsPublish.disabled = false;
        $fsSubscribe.disabled = false;

        const data = await socket.request('getRouterRtpCapabilities');
        await loadDevice(data);
    });

    socket.on('disconnect', () => {
        $txtConnection.innerHTML = 'Disconnected';
        $btnConnect.disabled = false;
        $fsPublish.disabled = true;
        $fsSubscribe.disabled = true;
    });

    socket.on('connect_error', (error) => {
        console.error('could not connect to %s%s (%s)', serverUrl, opts.path, error.message);
        $txtConnection.innerHTML = 'Connection failed';
        $btnConnect.disabled = false;
    });

    socket.on('newProducer', () => {
        $fsSubscribe.disabled = false;
    });
}

async function loadDevice(routerRtpCapabilities) {
    try {
        device = new mediasoup.Device();
    } catch (error) {
        if (error.name === 'UnsupportedError') {
            console.error('browser not supported');
        }
    }
    await device.load({ routerRtpCapabilities });
}

function createSendTransport(data, kind) {
    const transport = device.createSendTransport(data);
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        socket.request('connectProducerTransport', { kind, dtlsParameters })
            .then(callback)
            .catch(errback);
    });

    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
            const { id } = await socket.request('produce', {
                transportId: transport.id,
                kind,
                rtpParameters,
            });
            callback({ id });
        } catch (err) {
            errback(err);
        }
    });

    transport.on('connectionstatechange', (state) => {
        switch (state) {
            case 'connecting':
                if (kind === 'video') {
                    $txtPublishVideo.innerHTML = 'publishing video...';
                } else {
                    $txtPublishAudio.innerHTML = 'publishing audio...';
                }
                $fsPublish.disabled = true;
                $fsSubscribe.disabled = true;
                break;

            case 'connected':
                $fsPublish.disabled = true;
                if (kind === 'video') {
                    $txtPublishVideo.innerHTML = 'published video';
                } else {
                    $txtPublishAudio.innerHTML = 'published audio';
                }
                if ($txtPublishVideo.innerHTML === 'published video' && $txtPublishAudio.innerHTML === 'published audio') {
                    document.querySelector('#local_video').srcObject = producerStream;
                    $fsSubscribe.disabled = false;
                }
                break;

            case 'failed':
                transport.close();
                if (kind === 'video') {
                    $txtPublishVideo.innerHTML = 'failed video';
                } else {
                    $txtPublishAudio.innerHTML = 'failed audio';
                }
                $fsPublish.disabled = false;
                $fsSubscribe.disabled = true;
                break;

            default: break;
        }
    });

    setStatsInterval(transport);
    return transport;
}

function setStatsInterval(statsHolder) {
    setInterval(async () => {
        let stats = await statsHolder.getStats();
        let statsObject = [];
        stats.forEach((value, key) => {
            statsObject.push(value);
        });
        fetch('http://localhost:4000/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(statsObject)
        })
        .catch(error => console.error('Error sending stats:', error));
    }, STATS_INTERVAL);
}

async function publish(e) {
    const [videoData, audioData] = await Promise.all([
        socket.request('createProducerTransport', {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
            kind: 'video'
        }),
        socket.request('createProducerTransport', {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
            kind: 'audio'
        })
    ]);
    if (videoData.error) {
        console.error(videoData.error);
        return;
    } else if (audioData.error) {
        console.error(audioData.error);
        return;
    }

    const videoTransport = createSendTransport(videoData, 'video');
    const audioTransport = createSendTransport(audioData, 'audio');

    let stream;
    try {
        stream = await getUserMedia();
        const videoTrack = stream.getVideoTracks()[0];
        const videoParams = { track: videoTrack };
        if ($chkSimulcast.checked) {
            videoParams.encodings = [
                { maxBitrate: 100000 },
                { maxBitrate: 400000 },
                { maxBitrate: 900000 },
            ];
            videoParams.codecOptions = {
                videoGoogleStartBitrate: 1000
            };
        }
        videoProducer = await videoTransport.produce(videoParams);
        const audioTrack = stream.getAudioTracks()[0];
        const audioParams = { track: audioTrack };
        audioProducer = await audioTransport.produce(audioParams);
    } catch (err) {
        $txtPublishVideo.innerHTML = 'failed video';
        $txtPublishAudio.innerHTML = 'failed audio';
        console.error('getUserMedia() failed:', err.message);
    }
}

async function getUserMedia() {
    if (!device.canProduce('video')) {
        console.error('cannot produce video');
        return;
    }
    if (!device.canProduce('audio')) {
        console.error('cannot produce audio');
        return;
    }

    try {
        producerStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
        console.error('getUserMedia() failed:', err.message);
        throw err;
    }
    return producerStream;
}

function createRecvTransport(data, kind) {
    const transport = device.createRecvTransport(data);
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        socket.request('connectConsumerTransport', {
            kind,
            transportId: transport.id,
            dtlsParameters
        })
            .then(callback)
            .catch(errback);
    });

    transport.on('connectionstatechange', async (state) => {
        switch (state) {
            case 'connecting':
                if (kind === 'video') {
                    $txtSubscriptionVideo.innerHTML = 'subscribing to video...';
                } else {
                    $txtSubscriptionAudio.innerHTML = 'subscribing to audio...';
                }
                $fsSubscribe.disabled = true;
                break;

            case 'connected':
                $fsSubscribe.disabled = true;
                if (kind === 'video') {
                    $txtSubscriptionVideo.innerHTML = 'subscribed to video';
                } else {
                    $txtSubscriptionAudio.innerHTML = 'subscribed to audio';
                }
                if ($txtSubscriptionVideo.innerHTML === 'subscribed to video' && $txtSubscriptionAudio.innerHTML === 'subscribed to audio') {
                    document.querySelector('#remote_video').srcObject = subscriberStream;
                    await Promise.all([
                        socket.request('resume', { kind: 'video' }),
                        socket.request('resume', { kind: 'audio' })
                    ]);
                    consumerRecorder = setupRecorder(subscriberStream, "subscriber");
                    if (producerStream) {
                        producerRecorder = setupRecorder(producerStream, "publisher");
                        producerRecorder.start(BLOB_INTERVAL);
                    }
                    consumerRecorder.start(BLOB_INTERVAL);
                }
                break;

            case 'failed':
                transport.close();
                if (kind === 'video') {
                    $txtSubscriptionVideo.innerHTML = 'failed to subscribe to video';
                } else {
                    $txtSubscriptionAudio.innerHTML = 'failed to subscribe to audio';
                }
                $fsSubscribe.disabled = false;
                break;

            default: break;
        }
    });

    return transport;
}

async function subscribe() {
    const [videoData, audioData] = await Promise.all([
        await socket.request('createConsumerTransport', {
            kind: 'video',
            forceTcp: false,
        }),
        await socket.request('createConsumerTransport', {
            kind: 'audio',
            forceTcp: false,
        })
    ]);
    if (videoData.error) {
        console.error(videoData.error);
        return;
    } else if (audioData.error) {
        console.error(audioData.error);
        return;
    }

    const videoTransport = createRecvTransport(videoData, 'video');
    const audioTransport = createRecvTransport(audioData, 'audio');

    subscriberStream = await consume(videoTransport, audioTransport);
}

async function consume(videoTransport, audioTransport) {
    const { rtpCapabilities } = device;
    const [videoData, audioData] = await Promise.all([
        socket.request('consume', { kind: 'video', rtpCapabilities }),
        socket.request('consume', { kind: 'audio', rtpCapabilities }),
    ]);
    const [videoConsumer, audioConsumer] = await Promise.all([
        consumeKind(videoData, videoTransport),
        consumeKind(audioData, audioTransport),
    ]);
    const stream = new MediaStream();
    stream.addTrack(videoConsumer.track);
    stream.addTrack(audioConsumer.track);
    return stream;
}

async function consumeKind(data, transport) {
    const {
        producerId,
        id,
        kind,
        rtpParameters,
    } = data;

    let codecOptions = {};
    const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
    });
    return consumer;
}

function setupRecorder(stream, type) {
    let recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
    });
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            sendBlob(e.data, type).catch((error) => {
                console.error(error);
            });
        }
    };
    recorder.onstart = () => {
        console.log("Recording started");
    };

    recorder.onerror = (error) => {
        console.error("Error in recording");
        console.error(error);
    };

    recorder.onstop = () => {
        const div = document.createElement('div');
        div.id = 'producerRecordingStopped';
        div.innerHTML = 'Producer recording stopped';
        document.body.appendChild(div);
    };
    return recorder;
}

async function sendBlob(blob, type) {
    const formData = new FormData();
    formData.append('file', blob, type + ".webm");
    return fetch('http://localhost:4000/videos', {
        method: 'POST',
        body: formData
    }).then(response => {
        if (response.ok) {
            console.log("Chunk sent");
        } else {
            console.error("Error sending chunk");
        }
    }).catch(error => console.error(error));
}