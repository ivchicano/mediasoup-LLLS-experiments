import chrome from "selenium-webdriver/chrome.js";
import { By, Capabilities, until, WebDriver, logging, WebElement } from 'selenium-webdriver';
import { SeleniumService } from './selenium.service.js';
import path from 'path';
import { __dirname } from '../dirname.js';
import config from '../config.js';

export class RealBrowserService {
    private readonly BROWSER_WAIT_TIMEOUT_MS = 30000;
	private chromeOptions = new chrome.Options();
	private chromeCapabilities = Capabilities.chrome();
    private readonly VIDEO_FILE_LOCATION = path.join(__dirname, '..', 'media', 'fakevideo.y4m');
	private readonly AUDIO_FILE_LOCATION = path.join(__dirname, '..', 'media', 'fakekaudio.wav');
    private seleniumService: SeleniumService | undefined;
    private seleniumLogger: logging.Logger;

    constructor() {
		const prefs = new logging.Preferences();
		this.seleniumLogger = logging.getLogger('webdriver');
		prefs.setLevel(logging.Type.BROWSER, logging.Level.INFO);
		prefs.setLevel(logging.Type.DRIVER, logging.Level.INFO);
		prefs.setLevel(logging.Type.CLIENT, logging.Level.INFO);
		prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.INFO);
		prefs.setLevel(logging.Type.SERVER, logging.Level.INFO);
		logging.installConsoleHandler();
        this.chromeCapabilities.setLoggingPrefs(prefs);
        this.chromeCapabilities.setAcceptInsecureCerts(true);
        this.chromeOptions.addArguments(
            '--disable-dev-shm-usage',
            "--no-sandbox",
            "--disable-gpu",
            "--disable-translate",
            "--allow-file-access-from-files",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--use-file-for-fake-video-capture=" + this.VIDEO_FILE_LOCATION,
            "--use-file-for-fake-audio-capture=" + this.AUDIO_FILE_LOCATION,
        );
	}

	public async startSelenium(): Promise<SeleniumService> {
		return SeleniumService.getInstance(this.VIDEO_FILE_LOCATION, this.AUDIO_FILE_LOCATION);
	}

    public async startBrowser(): Promise<void> {
        if (!this.seleniumService) {
            this.seleniumService = await this.startSelenium();
        }
        const driver = await this.seleniumService.getChromeDriver(this.chromeCapabilities, this.chromeOptions);
        await driver.manage().window().maximize();
        await driver.manage().setTimeouts({ implicit: this.BROWSER_WAIT_TIMEOUT_MS });
        await driver.get('http://localhost:4000');
        await driver.executeScript('return document.readyState').then((readyState) => {
            if (readyState !== 'complete') {
            return driver.wait(() => {
                return driver.executeScript('return document.readyState').then((readyState) => {
                return readyState === 'complete';
                });
            }, this.BROWSER_WAIT_TIMEOUT_MS);
            }
        });
        await driver.wait(until.elementLocated(By.id('server_url')), this.BROWSER_WAIT_TIMEOUT_MS);
        const serverUrl = await driver.findElement(By.id('server_url'));
        await serverUrl.clear();
        await serverUrl.sendKeys(config.serverUrl);
        await driver.wait(until.elementLocated(By.id('btn_connect')), this.BROWSER_WAIT_TIMEOUT_MS);
        const connectButton = await driver.findElement(By.id('btn_connect'));
        await connectButton.click();
        await driver.wait(until.elementLocated(By.id('connection_status')), this.BROWSER_WAIT_TIMEOUT_MS);
        await driver.wait(until.elementTextIs(driver.findElement(By.id('connection_status')), 'Connected'), this.BROWSER_WAIT_TIMEOUT_MS);
        await driver.wait(until.elementLocated(By.id('btn_webcam')), this.BROWSER_WAIT_TIMEOUT_MS);
        const webcamButton = await driver.findElement(By.id('btn_webcam'));
        await webcamButton.click();
        await Promise.all([
            driver.wait(until.elementLocated(By.id('webcam_status_video')), this.BROWSER_WAIT_TIMEOUT_MS),
            driver.wait(until.elementLocated(By.id('webcam_status_audio')), this.BROWSER_WAIT_TIMEOUT_MS)
        ]);
        await Promise.all([
            driver.wait(until.elementTextIs(driver.findElement(By.id('webcam_status_video')), 'published video'), this.BROWSER_WAIT_TIMEOUT_MS),
            driver.wait(until.elementTextIs(driver.findElement(By.id('webcam_status_audio')), 'published audio'), this.BROWSER_WAIT_TIMEOUT_MS)
        ]);
        await driver.wait(until.elementLocated(By.id('btn_subscribe')), this.BROWSER_WAIT_TIMEOUT_MS);
        const subscribeButton = await driver.findElement(By.id('btn_subscribe'));
        await subscribeButton.click();
        await Promise.all([
            driver.wait(until.elementLocated(By.id('sub_status_video')), this.BROWSER_WAIT_TIMEOUT_MS),
            driver.wait(until.elementLocated(By.id('sub_status_audio')), this.BROWSER_WAIT_TIMEOUT_MS)
        ]);
        await Promise.all([
            await driver.wait(until.elementTextIs(driver.findElement(By.id('sub_status_video')), 'subscribed to video'), this.BROWSER_WAIT_TIMEOUT_MS),
            await driver.wait(until.elementTextIs(driver.findElement(By.id('sub_status_audio')), 'subscribed to audio'), this.BROWSER_WAIT_TIMEOUT_MS)
        ]);
    }
}
