const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

async function createPPT() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'RollRoll AI创作平台功能介绍';
  pptx.author = 'RollRoll Team';

  const outputDir = 'j:/123pan/13998416173/NanoNoPort/ai-video-batch/screenshots';

  // 读取图片并转为base64
  function loadImage(imgName) {
    const imgPath = `${outputDir}/${imgName}`;
    if (!fs.existsSync(imgPath)) return null;
    const data = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase().slice(1);
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
    return `image/${mimeType};base64,${data.toString('base64')}`;
  }

  // ==================== 第1页：封面 ====================
  let slide1 = pptx.addSlide();
  slide1.background = { color: '0a0a1a' };

  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.25,
    fill: { color: '6366f1' }
  });
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.625, w: '100%', h: 0.25,
    fill: { color: '8b5cf6' }
  });

  // 装饰圆
  slide1.addShape(pptx.ShapeType.ellipse, {
    x: 10, y: 1.2, w: 3.5, h: 3.5,
    fill: { color: '6366f1', transparency: 85 }
  });
  slide1.addShape(pptx.ShapeType.ellipse, {
    x: 10.5, y: 1.7, w: 2.5, h: 2.5,
    fill: { color: '8b5cf6', transparency: 75 }
  });

  slide1.addText('RollRoll', {
    x: 0, y: 1.8, w: 15, h: 1.2,
    fontSize: 80, fontFace: 'Arial Black',
    color: 'FFFFFF', bold: true, align: 'center'
  });
  slide1.addText('AI创作平台', {
    x: 0, y: 3.1, w: 15, h: 0.8,
    fontSize: 40, fontFace: 'Microsoft YaHei',
    color: 'a5b4fc', align: 'center'
  });
  slide1.addText('lossloop.cn  |  rollroll.art', {
    x: 0, y: 4.3, w: 15, h: 0.5,
    fontSize: 20, fontFace: 'Arial',
    color: '94a3b8', align: 'center'
  });

  // ==================== 第2页：PC端首页 ====================
  let slide2 = pptx.addSlide();
  slide2.background = { color: 'f8fafc' };
  slide2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide2.addText('PC端首页 index.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const idxImg = loadImage('01-index.png');
  if (idxImg) slide2.addImage({ data: idxImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第3页：移动端首页 ====================
  let slide3 = pptx.addSlide();
  slide3.background = { color: 'f8fafc' };
  slide3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide3.addText('移动端首页 mobile.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const mobImg = loadImage('02-mobile.png');
  if (mobImg) slide3.addImage({ data: mobImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第4页：AI对话 ====================
  let slide4 = pptx.addSlide();
  slide4.background = { color: 'f8fafc' };
  slide4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide4.addText('AI对话 chat.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const chatImg = loadImage('03-chat.png');
  if (chatImg) slide4.addImage({ data: chatImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第5页：AI写作 ====================
  let slide5 = pptx.addSlide();
  slide5.background = { color: 'f8fafc' };
  slide5.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide5.addText('AI写作 writing.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const wrtImg = loadImage('04-writing.png');
  if (wrtImg) slide5.addImage({ data: wrtImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第6页：语音合成 ====================
  let slide6 = pptx.addSlide();
  slide6.background = { color: 'f8fafc' };
  slide6.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide6.addText('语音合成 voice.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const voiImg = loadImage('05-voice.png');
  if (voiImg) slide6.addImage({ data: voiImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第7页：音乐生成 ====================
  let slide7 = pptx.addSlide();
  slide7.background = { color: 'f8fafc' };
  slide7.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide7.addText('音乐生成 music.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const musImg = loadImage('06-music.png');
  if (musImg) slide7.addImage({ data: musImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第8页：视频生成 ====================
  let slide8 = pptx.addSlide();
  slide8.background = { color: 'f8fafc' };
  slide8.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide8.addText('视频生成 video.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const vidImg = loadImage('07-video.png');
  if (vidImg) slide8.addImage({ data: vidImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第9页：图片生成 ====================
  let slide9 = pptx.addSlide();
  slide9.background = { color: 'f8fafc' };
  slide9.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide9.addText('图片生成 image.html', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });
  const imgImg = loadImage('08-image.png');
  if (imgImg) slide9.addImage({ data: imgImg, x: 0.5, y: 1.1, w: 14.5, h: 4.4 });

  // ==================== 第10页：技术架构 ====================
  let slide10 = pptx.addSlide();
  slide10.background = { color: '0f172a' };
  slide10.addText('技术架构', {
    x: 0.5, y: 0.25, w: 14, h: 0.7,
    fontSize: 32, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true
  });

  const layers = [
    { name: '前端层', color: '6366f1', items: ['HTML/CSS/JS', '技能系统 36+', '智能体团队 UI', '移动端适配'] },
    { name: 'API层', color: '8b5cf6', items: ['Serverless Functions', '多节点负载均衡', '熔断降级机制', '计费系统'] },
    { name: '数据层', color: 'a855f7', items: ['Supabase', '用户认证', '消耗记录', 'VIP管理'] }
  ];

  layers.forEach((layer, i) => {
    const x = 0.5 + i * 5;
    slide10.addShape(pptx.ShapeType.roundRect, {
      x: x, y: 1.1, w: 4.5, h: 4.2,
      fill: { color: layer.color, transparency: 75 },
      line: { color: layer.color, width: 2 }, rectRadius: 0.2
    });
    slide10.addText(layer.name, {
      x: x, y: 1.3, w: 4.5, h: 0.6,
      fontSize: 22, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, align: 'center', margin: 0
    });
    slide10.addText(layer.items.map((item, idx) => ({
      text: item,
      options: { bullet: true, breakLine: idx < layer.items.length - 1 }
    })), {
      x: x + 0.3, y: 2.1, w: 4, h: 3,
      fontSize: 16, fontFace: 'Microsoft YaHei', color: 'e2e8f0'
    });
  });

  // ==================== 第11页：核心优势 ====================
  let slide11 = pptx.addSlide();
  slide11.background = { color: 'f8fafc' };
  slide11.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: '1e1b4b' } });
  slide11.addText('核心优势', {
    x: 0.5, y: 0.18, w: 14, h: 0.6,
    fontSize: 26, fontFace: 'Microsoft YaHei', color: 'FFFFFF', bold: true, margin: 0
  });

  const advantages = [
    { icon: '🚀', title: '极速生成', desc: '批量并发处理，秒级出图' },
    { icon: '💰', title: '低成本', desc: '免费额度每日更新' },
    { icon: '🎨', title: '多模态', desc: '视频/图片/音频/文案全覆盖' },
    { icon: '🤖', title: 'AI智能', desc: '多智能体协同，专业创作' },
    { icon: '🔒', title: '安全可靠', desc: 'Vercel全球加速，SLA保障' },
    { icon: '📱', title: '全平台', desc: 'PC/移动端自适应体验' }
  ];

  advantages.forEach((adv, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.5 + col * 5;
    const y = 1.15 + row * 2.1;

    slide11.addShape(pptx.ShapeType.roundRect, {
      x: x, y: y, w: 4.5, h: 1.9,
      fill: { color: 'FFFFFF' }, line: { color: 'e2e8f0', width: 1 }, rectRadius: 0.15
    });
    slide11.addText(adv.icon, { x: x, y: y + 0.1, w: 4.5, h: 0.6, fontSize: 32, align: 'center', margin: 0 });
    slide11.addText(adv.title, {
      x: x, y: y + 0.7, w: 4.5, h: 0.5,
      fontSize: 18, fontFace: 'Microsoft YaHei', color: '1e1b4b', bold: true, align: 'center', margin: 0
    });
    slide11.addText(adv.desc, {
      x: x, y: y + 1.2, w: 4.5, h: 0.5,
      fontSize: 13, fontFace: 'Microsoft YaHei', color: '64748b', align: 'center', margin: 0
    });
  });

  // ==================== 第12页：结束页 ====================
  let slide12 = pptx.addSlide();
  slide12.background = { color: '0a0a1a' };
  slide12.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.25, fill: { color: '6366f1' } });
  slide12.addShape(pptx.ShapeType.rect, { x: 0, y: 5.625, w: '100%', h: 0.25, fill: { color: '8b5cf6' } });
  slide12.addShape(pptx.ShapeType.ellipse, {
    x: 10, y: 1.2, w: 3.5, h: 3.5, fill: { color: '6366f1', transparency: 85 }
  });

  slide12.addText('RollRoll', {
    x: 0, y: 1.8, w: 15, h: 1,
    fontSize: 64, fontFace: 'Arial Black', color: 'FFFFFF', bold: true, align: 'center'
  });
  slide12.addText('让AI创作更简单', {
    x: 0, y: 2.9, w: 15, h: 0.7,
    fontSize: 28, fontFace: 'Microsoft YaHei', color: 'a5b4fc', align: 'center'
  });
  slide12.addText('lossloop.cn  |  rollroll.art', {
    x: 0, y: 4, w: 15, h: 0.5,
    fontSize: 20, fontFace: 'Arial', color: '94a3b8', align: 'center'
  });

  // 保存
  await pptx.writeFile({ fileName: 'j:/123pan/13998416173/NanoNoPort/ai-video-batch/RollRoll功能介绍.pptx' });
  console.log('PPT已生成: RollRoll功能介绍.pptx (12页)');
}

createPPT().catch(console.error);
