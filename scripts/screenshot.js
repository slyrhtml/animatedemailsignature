const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 400, deviceScaleFactor: 2 });
  const filePath = path.join(__dirname, '..', 'build', 'preview-local.html').replace(/\\/g, '/');
  await page.goto('file:///' + filePath);

  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'screenshot-frame1.png') });

  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'screenshot-mid.png') });

  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'screenshot-settled.png') });

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
