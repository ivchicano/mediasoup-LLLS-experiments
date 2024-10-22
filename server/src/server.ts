import config from './config.js';
import { __dirname } from './dirname.js';
import { setupExpress } from './express/express.js';
import { setupMediasoupWorker } from './mediasoup/mediasoup.js';
import { setupSocketIO } from './socket/socket.js';
import logger from './logger.js';


const [worker, httpServer] = await Promise.all([setupMediasoupWorker(), setupExpress()]);
const io = await setupSocketIO(httpServer);
const log = logger('Main');

httpServer.listen(config.listenPort, config.listenIp, () => {
    log.info(`Server running on ${config.listenIp}:${config.listenPort}`);
});
