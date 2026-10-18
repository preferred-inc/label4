import { defineConfig, devices } from "@playwright/test";

// 主要ページの表示と、PDF を読み込んで面付け枠に描画できるかだけを見るスモーク e2e。
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/static-server.mjs",
    url: "http://127.0.0.1:4174/label4/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
