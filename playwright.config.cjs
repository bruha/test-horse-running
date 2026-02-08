/** @type {import('@playwright/test').PlaywrightTestConfig} */
const SERVER_URL = "http://127.0.0.1:3000"
const DEV_SERVER_COMMAND = "env NODE_ENV=development NUXT_APP_BASE_URL=/ npm run dev"

const config = {
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: SERVER_URL,
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: DEV_SERVER_COMMAND,
    url: SERVER_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
}

module.exports = config
