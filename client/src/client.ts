import express from 'express'
import type { Request, Response } from 'express';
import path from 'path';
import { __dirname } from './dirname.js';
import { RealBrowserService } from './services/browser.service.js';
import { createFile, saveStatsToFile } from './utils/stats-files.js';
import fs from 'fs';
import multer from 'multer';
import logger from './logger.js';

const RECORDINGS_PATH = path.join(__dirname, '..', 'recordings');
const log = logger('Client');

if (!fs.existsSync(RECORDINGS_PATH)) {
    fs.mkdirSync(RECORDINGS_PATH, { recursive: true });
}
const storage = multer.memoryStorage();

const upload = multer({ storage });

async function setupExpress(): Promise<express.Express> {
    const app = express();
    app.use(express.static(path.resolve(__dirname, '..', 'public')));
    log.info('Express setup complete');
    return app;
}

const app = await setupExpress();
await createFile();

app.post('/stats', express.json(), async (req: Request, res: Response) => {
    const jsonArray = req.body;
    await saveStatsToFile(jsonArray);
    res.status(200).send();
});

app.post('/videos', upload.single("file"), (req: Request, res: Response): void => {
    if (!req.file) {
        res.status(400).send('No file uploaded.');
        return;
    }

    const buffer = req.file.buffer;

    fs.appendFile(`${RECORDINGS_PATH}/${req.file.originalname}`, buffer, (err) => {
        if (err) {
            res.status(500).send(err.message);
        } else {
            res.status(200).send();
        }
    });
});

app.listen(4000, async () => {
    log.info('Server is running on port 4000');
    const browserService = new RealBrowserService();
    await browserService.startBrowser();
    const test_duration_s = 10;
    setTimeout(async () => {
        log.info(`Exiting process after ${test_duration_s} seconds`);
        await browserService.stopBrowser();
        log.info('Test finished');
        process.exit(0);
    }, test_duration_s * 1000);
});
