import { defineConfig } from "@playwright/test";

/**
 * E2E 測試設定：需要伺服器（3001）與 client dev server（5173）同時活著，
 * 兩個都交給 Playwright 的 webServer 自動啟動/等待就緒，測試跑完後自動關閉。
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    // 某些環境預先裝好的 Chromium revision 跟 @playwright/test 預期抓的對不上；
    // 設定 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH 環境變數可以直接指定可執行檔路徑繞過版本解析，
    // 一般情況（本機執行過 `npx playwright install`）不用設，交給 Playwright 自動解析即可。
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: "npm run start -w server",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev -w client",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
