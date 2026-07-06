const path = require('path');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 400, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8080/signature-local.html?v=4', { waitUntil: 'networkidle0' });
  const el = await page.$('.signature-shell');
  await el.screenshot({ path: path.join(__dirname, '..', 'build', 'local-hq-social-check.png') });
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      animation.pause();
      animation.currentTime = 7000;
    });
  });
  await el.screenshot({ path: path.join(__dirname, '..', 'build', 'local-hq-forced-url-moment.png') });
  await page.reload({ waitUntil: 'networkidle0' });
  const freshEl = await page.$('.signature-shell');
  await new Promise((resolve) => setTimeout(resolve, 7000));
  await freshEl.screenshot({ path: path.join(__dirname, '..', 'build', 'local-hq-url-moment.png') });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await freshEl.screenshot({ path: path.join(__dirname, '..', 'build', 'local-hq-restored.png') });
  await browser.close();
  console.log('captured');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
