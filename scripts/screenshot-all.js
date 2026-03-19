const { chromium } = require('playwright');

async function takeAllScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium'
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const outputDir = 'j:/123pan/13998416173/NanoNoPort/ai-video-batch/screenshots';

  const pages = [
    { url: 'https://www.rollroll.art/index.html', name: '01-index' },
    { url: 'https://www.rollroll.art/mobile.html', name: '02-mobile' },
    { url: 'https://www.rollroll.art/chat.html', name: '03-chat' },
    { url: 'https://www.rollroll.art/writing.html', name: '04-writing' },
    { url: 'https://www.rollroll.art/voice.html', name: '05-voice' },
    { url: 'https://www.rollroll.art/music.html', name: '06-music' },
    { url: 'https://www.rollroll.art/video.html', name: '07-video' },
    { url: 'https://www.rollroll.art/image.html', name: '08-image' },
  ];

  for (const p of pages) {
    console.log(`截图 ${p.name}...`);
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({
        path: `${outputDir}/${p.name}.png`,
        fullPage: true  // 全页面截图
      });
      console.log(`  ✓ 完成`);
    } catch (err) {
      console.log(`  ✗ 失败: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n全部截图完成！');
}

takeAllScreenshots().catch(console.error);
