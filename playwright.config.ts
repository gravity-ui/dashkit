import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 180_000,
    expect: {timeout: 10_000},
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [['list'], ['html', {open: 'never'}]],
    use: {
        baseURL: 'http://127.0.0.1:7137',
        viewport: {width: 1000, height: 1000},
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 10_000,
    },
    projects: [
        {name: 'chromium', use: {...devices['Desktop Chrome']}},
        {name: 'firefox', use: {...devices['Desktop Firefox']}},
        {name: 'webkit', use: {...devices['Desktop Safari']}},
    ],
    webServer: {
        command: 'npm run start -- --port 7137 --ci --host 127.0.0.1 --no-open',
        url: 'http://127.0.0.1:7137/iframe.html',
        timeout: 180_000,
    },
});
