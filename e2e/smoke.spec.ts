import { test, expect } from "@playwright/test";
import { join } from "node:path";

// 外部（CDN・Google Fonts 等）への通信は遮断し、リポジトリ内のファイルだけで動くことを確認する。
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
});

const PAGES = ["/label4/", "/label4/clickpost/", "/label4/letterpack/", "/label4/nekopos/", "/label4/yupacket/", "/label4/blog/"];

for (const path of PAGES) {
  test(`${path} が表示される`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

test("PDF を読み込むと面付け枠に描画される（複数ページは次の枠へ展開）", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/label4/");

  const forms = page.locator("main#content form");
  await expect(forms).toHaveCount(4);

  // PDF.js 同梱のサンプル PDF（14ページ）
  await page.locator("#input-1").setInputFiles(join(process.cwd(), "web", "compressed.tracemonkey-pldi-09.pdf"));

  await expect(forms.nth(0)).toHaveClass(/selected/, { timeout: 30_000 });
  await expect(forms.nth(1)).toHaveClass(/selected/, { timeout: 30_000 });

  // 実際に描画されたこと（真っ白でないピクセルがある）
  const painted = await forms.nth(0).locator("canvas").evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < data.length; i += 4 * 97) {
      if (data[i + 3] !== 0 && (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200)) return true;
    }
    return false;
  });
  expect(painted).toBe(true);
  expect(errors).toEqual([]);
});
