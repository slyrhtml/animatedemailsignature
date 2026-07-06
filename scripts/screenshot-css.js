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

  await new Promise((r) => setTimeout(r, 50));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'css-t0.png') });

  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'css-t550.png') });

  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'css-t1050.png') });

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
