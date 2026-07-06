const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);
  await page.setViewport({ width: 700, height: 400, deviceScaleFactor: 2 });
  const filePath = path.join(__dirname, '..', 'build', 'preview-hosted.html');

  await page.setContent(fs.readFileSync(filePath, 'utf8'), { waitUntil: 'domcontentloaded', timeout: 0 });
  console.log('page ready');
  const start = Date.now();

  const targets = [4700, 7000]; // ms since navigation start
  for (const target of targets) {
    const elapsed = Date.now() - start;
    const wait = target - elapsed;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const canvas = await page.$('.canvas');
    await canvas.screenshot({ path: path.join(__dirname, '..', 'build', `cycle-${target}.png`) });
    console.log('captured', target);
  }

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
