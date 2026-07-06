const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 500 });
  const filePath = path.join(__dirname, '..', 'build', 'preview-local.html').replace(/\\/g, '/');
  await page.goto('file:///' + filePath);
  const box = await page.evaluate(() => {
    const el = document.querySelector('td.layout_border');
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  console.log(box);
  await browser.close();
})();
