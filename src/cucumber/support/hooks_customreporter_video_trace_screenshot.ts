// Alternative to hooks.ts that also records video, trace and an end-of-scenario
// screenshot for the TTA custom report. cucumber.js loads this file instead of
// hooks.ts when CUCUMBER_ARTIFACTS is set — never both, or every hook runs twice.
//
// Video and trace are attached as file paths (text/uri-list), not bytes, so the
// Cucumber HTML report doesn't embed them; CucumberTTAFormatter copies the files
// into tta-report.
import { BeforeAll, AfterAll, Before, After, Status, setDefaultTimeout } from "@cucumber/cucumber";
import { chromium, Browser } from '@playwright/test'
import * as path from 'path'
import { CustomWorld, BASE_URL } from './world'

const ARTIFACTS = 'test-results/cucumber';

setDefaultTimeout(60_000)
let browser: Browser;

BeforeAll(async function () {
    browser = await chromium.launch({ headless: !process.env.HEADED })
});

AfterAll(async function () {
    await browser?.close();
})

Before(async function (this: CustomWorld) {
    this.browser = browser;
    this.context = await browser.newContext({ baseURL: BASE_URL, recordVideo: { dir: `${ARTIFACTS}/videos` } });
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    this.page = await this.context.newPage();
    this.initPages();
})

After(async function (this: CustomWorld, { pickle, result }) {
    if (this.page) {
        const png = await this.page.screenshot();
        this.attach(png, { mediaType: 'image/png', fileName: result?.status === Status.FAILED ? 'failure' : 'final' });
    }
    if (!this.context) return;

    const tracePath = path.resolve(ARTIFACTS, 'traces', `${pickle.id}.zip`);
    await this.context.tracing.stop({ path: tracePath });
    this.attach(tracePath, { mediaType: 'text/uri-list', fileName: 'trace' });

    const video = this.page?.video();
    await this.page?.close();
    await this.context.close(); // finalizes the video file
    if (video) this.attach(await video.path(), { mediaType: 'text/uri-list', fileName: 'video' });
})
