const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium'
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const outputDir = 'j:/123pan/13998416173/NanoNoPort/ai-video-batch/screenshots';

  // 截取移动端首页
  console.log('截图 mobile.html...');
  await page.goto('https://www.rollroll.art/mobile.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/01-mobile-home.png`, fullPage: false });

  // 截取chat页面
  console.log('截图 chat.html...');
  await page.goto('https://www.rollroll.art/chat.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/02-chat.png`, fullPage: false });

  // 截取writing页面
  console.log('截图 writing.html...');
  await page.goto('https://www.rollroll.art/writing.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/03-writing.png`, fullPage: false });

  // 截取voice页面
  console.log('截图 voice.html...');
  await page.goto('https://www.rollroll.art/voice.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/04-voice.png`, fullPage: false });

  // 截取music页面
  console.log('截图 music.html...');
  await page.goto('https://www.rollroll.art/music.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outputDir}/05-music.png`, fullPage: false });

  await browser.close();
  console.log('截图完成！');
}

takeScreenshots().catch(console.error);
