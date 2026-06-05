const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const fileUrl = pathToFileURL(path.resolve('outputs/foncity_spotify_suncity_takeover_deck.html')).href;
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const runs = [
    { name: 'desktop', width: 1440, height: 900, shots: [0, 5, 10, 11] },
    { name: 'mobile', width: 390, height: 844, shots: [0, 6, 11] }
  ];
  const report = [];
  for (const run of runs) {
    const page = await browser.newPage({ viewport: { width: run.width, height: run.height }, deviceScaleFactor: 1 });
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const base = await page.evaluate(() => ({
      title: document.title,
      slideCount: document.querySelectorAll('.slide').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    }));
    const slideMetrics = [];
    for (const index of run.shots) {
      await page.evaluate((i) => {
        const slide = document.querySelectorAll('.slide')[i];
        window.scrollTo({ top: slide.offsetTop, behavior: 'instant' });
        window.setActive && window.setActive(i);
      }, index);
      await page.waitForTimeout(300);
      const metric = await page.evaluate((i) => {
        const slide = document.querySelectorAll('.slide')[i];
        const r = slide.getBoundingClientRect();
        const textBoxes = [...slide.querySelectorAll('h1,h2,h3,p,li,.meta span,.stat .label')].filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        }).map((el) => {
          const b = el.getBoundingClientRect();
          return { text: el.textContent.trim().slice(0, 70), left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        });
        const horizontalOut = textBoxes.filter((b) => b.left < -2 || b.right > window.innerWidth + 2);
        return { index: i + 1, top: r.top, height: r.height, horizontalOutCount: horizontalOut.length, active: slide.classList.contains('is-visible') };
      }, index);
      slideMetrics.push(metric);
      await page.screenshot({ path: `work/qa2-${run.name}-slide-${index + 1}.png`, fullPage: false });
    }
    report.push({ viewport: run.name, ...base, slideMetrics });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
