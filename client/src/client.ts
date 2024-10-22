import express from 'express';
import path from 'path';
import { __dirname } from './dirname.js';
import { RealBrowserService } from './services/browser.service.js';

async function setupExpress(): Promise<express.Express> {
    const app = express();
    app.use(express.static(path.resolve(__dirname, '..', 'public')));
    console.log('Express setup complete');
    return app;
}

const app = await setupExpress();

app.listen(4000, async () => {
    console.log('Server is running on port 4000');
    const browserService = new RealBrowserService();
    await browserService.startBrowser();
    console.log('Test finished');
    //process.exit(0);
});
