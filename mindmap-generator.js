const pptxgen = require("pptxgenjs");

// 创建演示文稿
let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'WorkBuddy';
pres.title = 'RollRoll AI 项目功能思维导图';

// 配色方案 - Ocean Gradient
const colors = {
  primary: "065A82",      // 深蓝
  secondary: "1C7293",    // 青蓝
  accent: "02C39A",       // 薄荷绿
  dark: "21295C",         // 深夜蓝
  light: "E8F4F8",        // 浅蓝白
  white: "FFFFFF",
  text: "1E293B",
  textLight: "64748B"
};

// ==================== Slide 1: 封面 ====================
let slide1 = pres.addSlide();
slide1.background = { color: colors.dark };

// 主标题
slide1.addText("🎬 RollRoll AI", {
  x: 0.5, y: 1.8, w: 9, h: 1.2,
  fontSize: 54, fontFace: "Arial Black", color: colors.white, align: "center"
});

slide1.addText("AI 多媒体创作平台功能全景", {
  x: 0.5, y: 3.0, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", color: colors.accent, align: "center"
});

slide1.addText("Serverless + Vanilla JS + Supabase", {
  x: 0.5, y: 3.8, w: 9, h: 0.5,
  fontSize: 18, fontFace: "Arial", color: colors.textLight, align: "center"
});

// 底部信息
slide1.addText("www.rollroll.art | lossloop.cn", {
  x: 0.5, y: 5.0, w: 9, h: 0.4,
  fontSize: 14, fontFace: "Arial", color: colors.textLight, align: "center"
});

// ==================== Slide 2: 项目总览 ====================
let slide2 = pres.addSlide();
slide2.background = { color: colors.light };

// 标题栏
slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.primary }
});
slide2.addText("🎯 项目总览", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 核心定位卡片
slide2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.2, w: 9, h: 1.2, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 6, offset: 2, opacity: 0.1 }
});
slide2.addText("一站式 AI 创意平台：视频生成 • 图像创作 • 音频制作 • 文本写作 • 多智能体协作", {
  x: 0.7, y: 1.5, w: 8.6, h: 0.6,
  fontSize: 20, fontFace: "Arial", color: colors.text, align: "center"
});

// 三大核心特性
const features = [
  { icon: "⚡", title: "Serverless 架构", desc: "Vercel 无服务器函数\n按需扩展，零运维" },
  { icon: "🔐", title: "统一认证计费", desc: "Supabase 认证 + 存储\n两阶段扣费机制" },
  { icon: "🤖", title: "多模型集成", desc: "10+ 视频模型\n10+ 图像模型" }
];

features.forEach((f, i) => {
  const x = 0.5 + i * 3.1;
  slide2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 2.7, w: 2.9, h: 1.8, fill: { color: colors.white },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
  });
  slide2.addText(f.icon, { x: x, y: 2.85, w: 2.9, h: 0.5, fontSize: 28, align: "center" });
  slide2.addText(f.title, { x: x + 0.1, y: 3.35, w: 2.7, h: 0.4, fontSize: 14, bold: true, color: colors.primary, align: "center" });
  slide2.addText(f.desc, { x: x + 0.1, y: 3.75, w: 2.7, h: 0.65, fontSize: 11, color: colors.textLight, align: "center" });
});

// 技术栈
slide2.addText("技术栈：前端 (原生JS/CSS) → 后端 (Vercel Functions) → 数据库 (Supabase) → AI模型 (Sora2/Wan/Gemini/MJ等)", {
  x: 0.5, y: 4.8, w: 9, h: 0.5,
  fontSize: 12, fontFace: "Arial", color: colors.textLight, align: "center"
});

// ==================== Slide 3: 页面结构 ====================
let slide3 = pres.addSlide();
slide3.background = { color: colors.light };

slide3.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.secondary }
});
slide3.addText("📄 页面文件结构", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 主要入口
slide3.addText("主要入口页面", {
  x: 0.5, y: 1.0, w: 2.5, h: 0.4, fontSize: 16, bold: true, color: colors.primary
});

const mainPages = [
  { file: "index.html", desc: "PC端主页面\n视频批量生成工作台" },
  { file: "mobile.html", desc: "移动端主页面 (734KB)\n功能最完整" },
  { file: "chat.html", desc: "AI聊天界面\n集成多智能体团队系统" }
];

mainPages.forEach((p, i) => {
  const y = 1.5 + i * 0.7;
  slide3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: y, w: 0.08, h: 0.55, fill: { color: colors.accent } });
  slide3.addText(p.file, { x: 0.7, y: y, w: 2.0, h: 0.55, fontSize: 12, bold: true, color: colors.text });
  slide3.addText(p.desc, { x: 2.7, y: y, w: 2.0, h: 0.55, fontSize: 10, color: colors.textLight });
});

// 功能子页面
slide3.addText("功能子页面", {
  x: 5.2, y: 1.0, w: 2.5, h: 0.4, fontSize: 16, bold: true, color: colors.primary
});

const subPages = [
  { file: "banana.html", desc: "AI画图工具" },
  { file: "video-tools.html", desc: "视频工具箱" },
  { file: "voice.html", desc: "AI配音 (TTS)" },
  { file: "music.html", desc: "AI音乐生成" },
  { file: "writing.html", desc: "AI写作工具" },
  { file: "knolling.html", desc: "Knolling拆解图" }
];

subPages.forEach((p, i) => {
  const y = 1.5 + i * 0.55;
  slide3.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: y, w: 0.06, h: 0.4, fill: { color: colors.secondary } });
  slide3.addText(p.file, { x: 5.4, y: y, w: 2.0, h: 0.4, fontSize: 11, bold: true, color: colors.text });
  slide3.addText(p.desc, { x: 7.4, y: y, w: 2.0, h: 0.4, fontSize: 10, color: colors.textLight });
});

// 用户系统
slide3.addText("用户系统页面", {
  x: 0.5, y: 3.7, w: 2.5, h: 0.4, fontSize: 16, bold: true, color: colors.primary
});

const userPages = [
  { file: "auth.html", desc: "登录/注册" },
  { file: "user.html", desc: "用户中心" },
  { file: "buy.html", desc: "充值购买" },
  { file: "welcome-*.html", desc: "欢迎页系列" }
];

userPages.forEach((p, i) => {
  const y = 4.2 + i * 0.4;
  slide3.addText(p.file, { x: 0.7, y: y, w: 2.0, h: 0.35, fontSize: 11, bold: true, color: colors.text });
  slide3.addText(p.desc, { x: 2.7, y: y, w: 2.0, h: 0.35, fontSize: 10, color: colors.textLight });
});

// ==================== Slide 4: 核心JS模块 ====================
let slide4 = pres.addSlide();
slide4.background = { color: colors.light };

slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.accent }
});
slide4.addText("🧩 核心JS模块架构", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 技能系统
slide4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 1.0, w: 3.0, h: 2.3, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide4.addText("🎯 技能系统", { x: 0.4, y: 1.1, w: 2.8, h: 0.4, fontSize: 14, bold: true, color: colors.primary });
slide4.addText([
  { text: "skill-system.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• SkillManager 管理器\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 技能注册/执行/取消\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 最大并发3控制\n", options: { fontSize: 10, breakLine: true } },
  { text: "\nskill-presets.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• 100+ 预置技能模板\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 自我迭代代理系统", options: { fontSize: 10 } }
], { x: 0.4, y: 1.5, w: 2.8, h: 1.7, fontSize: 11 });

// 多智能体团队
slide4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 3.5, y: 1.0, w: 3.0, h: 2.3, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide4.addText("🤖 多智能体团队", { x: 3.6, y: 1.1, w: 2.8, h: 0.4, fontSize: 14, bold: true, color: colors.primary });
slide4.addText([
  { text: "agent-team.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• ToolRegistry 工具注册\n", options: { fontSize: 10, breakLine: true } },
  { text: "• AgentTeam 协作调度\n", options: { fontSize: 10, breakLine: true } },
  { text: "\nagent-roles.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• 21个专业角色\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 10个预设团队模板\n", options: { fontSize: 10, breakLine: true } },
  { text: "\nagent-ui.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• 团队面板交互组件", options: { fontSize: 10 } }
], { x: 3.6, y: 1.5, w: 2.8, h: 1.7, fontSize: 11 });

// API核心
slide4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 6.7, y: 1.0, w: 3.0, h: 2.3, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide4.addText("🔌 API核心", { x: 6.8, y: 1.1, w: 2.8, h: 0.4, fontSize: 14, bold: true, color: colors.primary });
slide4.addText([
  { text: "api-core.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• 统一API调用封装\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 视频生成 API\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 图片生成 API\n", options: { fontSize: 10, breakLine: true } },
  { text: "• TTS/OCR API\n", options: { fontSize: 10, breakLine: true } },
  { text: "\nresilient-api.js\n", options: { bold: true, color: colors.text, breakLine: true } },
  { text: "• 负载均衡\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 熔断降级机制", options: { fontSize: 10 } }
], { x: 6.8, y: 1.5, w: 2.8, h: 1.7, fontSize: 11 });

// 基础设施
slide4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 3.5, w: 4.6, h: 1.7, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide4.addText("🏗️ 基础设施", { x: 0.4, y: 3.6, w: 4.4, h: 0.4, fontSize: 14, bold: true, color: colors.primary });
slide4.addText([
  { text: "billing.js - 两阶段扣费 (预扣→执行→确认/退还)\n", options: { fontSize: 10, breakLine: true } },
  { text: "task-orchestrator.js - 任务调度器 (优先级队列/断点续传)\n", options: { fontSize: 10, breakLine: true } },
  { text: "supabase-config.js - 认证配置 (本地缓存/多重备份)", options: { fontSize: 10 } }
], { x: 0.4, y: 4.0, w: 4.4, h: 1.1, fontSize: 11, color: colors.text });

// 其他模块
slide4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 5.1, y: 3.5, w: 4.6, h: 1.7, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide4.addText("📚 其他模块", { x: 5.2, y: 3.6, w: 4.4, h: 0.4, fontSize: 14, bold: true, color: colors.primary });
slide4.addText([
  { text: "novel-engine.js - 长篇小说引擎 (IndexedDB/断点恢复)\n", options: { fontSize: 10, breakLine: true } },
  { text: "prompt-templates.js - 100+ 提示词模板\n", options: { fontSize: 10, breakLine: true } },
  { text: "batch.js - PC端批量工作流", options: { fontSize: 10 } }
], { x: 5.2, y: 4.0, w: 4.4, h: 1.1, fontSize: 11, color: colors.text });

// ==================== Slide 5: 技能系统详情 ====================
let slide5 = pres.addSlide();
slide5.background = { color: colors.light };

slide5.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.primary }
});
slide5.addText("🎯 技能系统详解", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// SkillManager
slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 1.0, w: 4.6, h: 2.0, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide5.addText("SkillManager 核心功能", { x: 0.5, y: 1.1, w: 4.2, h: 0.35, fontSize: 14, bold: true, color: colors.primary });
slide5.addText([
  { text: "• register() - 技能注册\n", options: { fontSize: 11, breakLine: true } },
  { text: "• execute() - 执行技能 (进度回调/步骤回调)\n", options: { fontSize: 11, breakLine: true } },
  { text: "• cancel() - 取消执行\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 最大并发控制 (默认3)\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 一次性预扣费机制\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 历史记录 & 收藏功能", options: { fontSize: 11 } }
], { x: 0.5, y: 1.5, w: 4.2, h: 1.4, color: colors.text });

// SkillUI
slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 5.1, y: 1.0, w: 4.6, h: 2.0, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide5.addText("SkillUI 界面组件", { x: 5.3, y: 1.1, w: 4.2, h: 0.35, fontSize: 14, bold: true, color: colors.primary });
slide5.addText([
  { text: "• 技能卡片列表渲染\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 分类过滤 & 搜索\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 参数表单自动生成\n", options: { fontSize: 11, breakLine: true } },
  { text: "  支持类型: text/number/textarea/\n  select/checkbox/file/image\n", options: { fontSize: 10, breakLine: true } },
  { text: "• 进度面板显示", options: { fontSize: 11 } }
], { x: 5.3, y: 1.5, w: 4.2, h: 1.4, color: colors.text });

// 技能分类
slide5.addText("技能分类 (7大类)", { x: 0.5, y: 3.2, w: 2.5, h: 0.35, fontSize: 14, bold: true, color: colors.primary });

const skillCategories = [
  { name: "video", icon: "🎬", desc: "视频创作" },
  { name: "image", icon: "🎨", desc: "图像创作" },
  { name: "content", icon: "✍️", desc: "文本内容" },
  { name: "audio", icon: "🎵", desc: "音频制作" },
  { name: "design", icon: "🖼️", desc: "设计工具" },
  { name: "tool", icon: "🔧", desc: "实用工具" },
  { name: "automation", icon: "⚡", desc: "自动化" }
];

skillCategories.forEach((c, i) => {
  const x = 0.5 + i * 1.35;
  slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 3.6, w: 1.25, h: 0.9, fill: { color: colors.secondary },
    shadow: { type: "outer", color: "000000", blur: 2, offset: 1, opacity: 0.1 }
  });
  slide5.addText(c.icon, { x: x, y: 3.65, w: 1.25, h: 0.4, fontSize: 20, align: "center" });
  slide5.addText(c.desc, { x: x, y: 4.05, w: 1.25, h: 0.35, fontSize: 10, color: colors.white, align: "center" });
});

// 支持模型
slide5.addText("支持的AI模型", { x: 0.5, y: 4.7, w: 2.5, h: 0.3, fontSize: 12, bold: true, color: colors.text });
slide5.addText("视频: Wan2.6 / Grok Video 3 / Veo 3.1 / Vidu / Kling / Hailuo / LTX-Video  |  图像: Gemini Flash / Banana / 星梦画师 / MJ / ModelScope", {
  x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 10, color: colors.textLight
});

// ==================== Slide 6: 多智能体团队 ====================
let slide6 = pres.addSlide();
slide6.background = { color: colors.light };

slide6.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.secondary }
});
slide6.addText("🤖 多智能体团队系统", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 核心组件
slide6.addText("核心组件架构", { x: 0.5, y: 1.0, w: 3, h: 0.35, fontSize: 14, bold: true, color: colors.primary });

slide6.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 1.4, w: 3.0, h: 1.5, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 3, offset: 1, opacity: 0.1 }
});
slide6.addText("ToolRegistry\n工具注册表", { x: 0.4, y: 1.5, w: 2.8, h: 0.5, fontSize: 12, bold: true, color: colors.primary, align: "center" });
slide6.addText("映射 tool_id → API函数\n20+ 工具能力", { x: 0.4, y: 2.0, w: 2.8, h: 0.7, fontSize: 10, color: colors.textLight, align: "center" });

slide6.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 3.5, y: 1.4, w: 3.0, h: 1.5, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 3, offset: 1, opacity: 0.1 }
});
slide6.addText("AgentTeam\n团队协作", { x: 3.6, y: 1.5, w: 2.8, h: 0.5, fontSize: 12, bold: true, color: colors.primary, align: "center" });
slide6.addText("LLM驱动智能调度\n并行/串行编排", { x: 3.6, y: 2.0, w: 2.8, h: 0.7, fontSize: 10, color: colors.textLight, align: "center" });

slide6.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 6.7, y: 1.4, w: 3.0, h: 1.5, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 3, offset: 1, opacity: 0.1 }
});
slide6.addText("AgentUI\n交互面板", { x: 6.8, y: 1.5, w: 2.8, h: 0.5, fontSize: 12, bold: true, color: colors.primary, align: "center" });
slide6.addText("团队选择/配置/执行\n结果展示", { x: 6.8, y: 2.0, w: 2.8, h: 0.7, fontSize: 10, color: colors.textLight, align: "center" });

// 21个角色
slide6.addText("21个专业智能体角色", { x: 0.5, y: 3.1, w: 4, h: 0.35, fontSize: 14, bold: true, color: colors.primary });

const roles = [
  { icon: "👔", name: "coordinator", desc: "项目总监" },
  { icon: "✍️", name: "copywriter", desc: "文案策划" },
  { icon: "🎨", name: "visual_artist", desc: "视觉设计师" },
  { icon: "🎬", name: "video_producer", desc: "视频制作" },
  { icon: "💡", name: "brand_strategist", desc: "品牌顾问" },
  { icon: "🧸", name: "character_designer", desc: "角色设计师" },
  { icon: "🎤", name: "voice_artist", desc: "配音师" },
  { icon: "🎥", name: "director", desc: "导演" },
  { icon: "🖼️", name: "storyboard_master", desc: "分镜大师" },
  { icon: "✏️", name: "comic_artist", desc: "漫画家" },
  { icon: "🎵", name: "music_producer", desc: "音乐制作人" },
  { icon: "🧊", name: "3d_artist", desc: "3D建模师" }
];

roles.forEach((r, i) => {
  const x = 0.3 + (i % 6) * 1.6;
  const y = 3.5 + Math.floor(i / 6) * 0.55;
  slide6.addText(`${r.icon} ${r.desc}`, { x: x, y: y, w: 1.5, h: 0.45, fontSize: 10, color: colors.text });
});

// 10个团队模板
slide6.addText("10个预设团队模板", { x: 0.5, y: 5.0, w: 4, h: 0.3, fontSize: 12, bold: true, color: colors.text });
slide6.addText("品牌全案 | 短视频 | IP设计 | 电商 | 音频制作 | 有声小说 | 漫画创作 | 小说转短剧 | 影视制作 | 混元3D建模", {
  x: 0.5, y: 5.3, w: 9, h: 0.3, fontSize: 10, color: colors.textLight
});

// ==================== Slide 7: API端点 ====================
let slide7 = pres.addSlide();
slide7.background = { color: colors.light };

slide7.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.accent }
});
slide7.addText("🔌 Serverless API 端点", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// API列表
const apis = [
  { file: "sora2.js", desc: "Sora2 视频生成代理", cost: "7~14胶片" },
  { file: "banana2.js", desc: "Banana2 图片生成代理", cost: "4~10胶片" },
  { file: "yunwu.js", desc: "云雾AI多模态代理", cost: "按配置" },
  { file: "suno.js", desc: "Suno 音乐生成代理", cost: "8胶片/首" },
  { file: "modelscope.js", desc: "ModelScope 免费API", cost: "0~3胶片" },
  { file: "supabase-proxy.js", desc: "数据库/认证代理", cost: "-" },
  { file: "proxy.js", desc: "通用代理 + IP限流", cost: "-" },
  { file: "writer-llm.js", desc: "写作 LLM", cost: "-" }
];

// 表头
slide7.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.0, w: 9.4, h: 0.45, fill: { color: colors.primary } });
slide7.addText("API文件", { x: 0.4, y: 1.05, w: 2.5, h: 0.35, fontSize: 12, bold: true, color: colors.white });
slide7.addText("功能描述", { x: 2.9, y: 1.05, w: 4.5, h: 0.35, fontSize: 12, bold: true, color: colors.white });
slide7.addText("计费", { x: 7.4, y: 1.05, w: 2.2, h: 0.35, fontSize: 12, bold: true, color: colors.white });

apis.forEach((api, i) => {
  const y = 1.5 + i * 0.48;
  const bgColor = i % 2 === 0 ? colors.white : "F8FAFC";
  slide7.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: y, w: 9.4, h: 0.45, fill: { color: bgColor } });
  slide7.addText(api.file, { x: 0.4, y: y + 0.05, w: 2.5, h: 0.35, fontSize: 11, bold: true, color: colors.secondary });
  slide7.addText(api.desc, { x: 2.9, y: y + 0.05, w: 4.5, h: 0.35, fontSize: 11, color: colors.text });
  slide7.addText(api.cost, { x: 7.4, y: y + 0.05, w: 2.2, h: 0.35, fontSize: 11, color: colors.textLight });
});

// 计费说明
slide7.addText("胶片计费单位: 1胶片 = 10 units | 通过 /api/supabase-proxy 的 consume/recharge action 实现", {
  x: 0.3, y: 5.2, w: 9.4, h: 0.3, fontSize: 10, color: colors.textLight
});

// ==================== Slide 8: 计费系统 ====================
let slide8 = pres.addSlide();
slide8.background = { color: colors.light };

slide8.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.primary }
});
slide8.addText("💰 统一计费系统", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 两阶段扣费流程
slide8.addText("两阶段扣费流程", { x: 0.5, y: 1.0, w: 3, h: 0.4, fontSize: 16, bold: true, color: colors.primary });

// 流程图
const steps = [
  { num: "1", title: "reserveFilm()", desc: "预扣费冻结", color: colors.secondary },
  { num: "2", title: "API调用", desc: "执行请求", color: colors.accent },
  { num: "3a", title: "commitFilm()", desc: "确认扣费", color: "22C55E" },
  { num: "3b", title: "releaseFilm()", desc: "释放冻结", color: "EF4444" }
];

steps.forEach((s, i) => {
  const x = 0.5 + i * 2.4;
  slide8.addShape(pres.shapes.OVAL, { x: x + 0.6, y: 1.5, w: 0.8, h: 0.8, fill: { color: s.color } });
  slide8.addText(s.num, { x: x + 0.6, y: 1.65, w: 0.8, h: 0.5, fontSize: 14, bold: true, color: colors.white, align: "center" });
  slide8.addText(s.title, { x: x, y: 2.4, w: 2.0, h: 0.35, fontSize: 12, bold: true, color: colors.text, align: "center" });
  slide8.addText(s.desc, { x: x, y: 2.75, w: 2.0, h: 0.3, fontSize: 10, color: colors.textLight, align: "center" });
  
  // 箭头
  if (i < 2) {
    slide8.addShape(pres.shapes.RIGHT_ARROW, { x: x + 1.8, y: 1.75, w: 0.5, h: 0.3, fill: { color: colors.textLight } });
  }
  if (i === 2) {
    slide8.addText("成功", { x: x + 1.8, y: 1.75, w: 0.8, h: 0.3, fontSize: 10, color: "22C55E" });
  }
  if (i === 3) {
    slide8.addText("失败", { x: x + 1.8, y: 1.75, w: 0.8, h: 0.3, fontSize: 10, color: "EF4444" });
  }
});

// 视频模型计费
slide8.addText("视频模型计费表", { x: 0.5, y: 3.3, w: 3, h: 0.35, fontSize: 14, bold: true, color: colors.primary });

const videoCosts = [
  ["模型", "胶片"],
  ["Wan2.6 720p 5s", "3"],
  ["Wan2.6 720p 10s 有声", "7"],
  ["Wan2.6 1080p 15s 有声", "21"],
  ["Grok Video 3 6s/15s", "5~12"],
  ["Veo 3.1", "30"],
  ["Kling 2.5 720p 5s", "6"]
];

slide8.addTable(videoCosts, {
  x: 0.3, y: 3.7, w: 4.5, h: 1.8,
  fontFace: "Arial", fontSize: 10,
  border: { pt: 0.5, color: "E2E8F0" },
  fill: { color: colors.white },
  colW: [3.0, 1.5],
  align: "left"
});

// TTS计费
slide8.addText("TTS配音计费", { x: 5.2, y: 3.3, w: 3, h: 0.35, fontSize: 14, bold: true, color: colors.primary });

const ttsCosts = [
  ["引擎", "胶片"],
  ["DubbingX", "2"],
  ["Kling TTS", "2"],
  ["Gemini Flash", "1"],
  ["Gemini Pro", "3"]
];

slide8.addTable(ttsCosts, {
  x: 5.2, y: 3.7, w: 4.3, h: 1.2,
  fontFace: "Arial", fontSize: 10,
  border: { pt: 0.5, color: "E2E8F0" },
  fill: { color: colors.white },
  colW: [2.8, 1.5],
  align: "left"
});

// ==================== Slide 9: 基础设施特性 ====================
let slide9 = pres.addSlide();
slide9.background = { color: colors.light };

slide9.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.8, fill: { color: colors.dark }
});
slide9.addText("🏗️ 基础设施特性", {
  x: 0.5, y: 0.15, w: 9, h: 0.5,
  fontSize: 28, fontFace: "Arial Black", color: colors.white
});

// 弹性API网关
slide9.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 1.0, w: 4.6, h: 2.2, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide9.addText("弹性API网关 (resilient-api.js)", { x: 0.5, y: 1.1, w: 4.2, h: 0.4, fontSize: 13, bold: true, color: colors.primary });
slide9.addText([
  { text: "• 负载均衡 - 多节点自动分发\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 熔断机制 - 连续3次失败触发熔断\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 健康检查 - 定期探测节点状态\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 成本优化 - 根据价格选择最优节点\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 智能降级 - 付费→免费自动切换", options: { fontSize: 11 } }
], { x: 0.5, y: 1.55, w: 4.2, h: 1.5, color: colors.text });

// 任务调度器
slide9.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 5.1, y: 1.0, w: 4.6, h: 2.2, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide9.addText("任务调度器 (task-orchestrator.js)", { x: 5.3, y: 1.1, w: 4.2, h: 0.4, fontSize: 13, bold: true, color: colors.primary });
slide9.addText([
  { text: "• 优先级队列 - URGENT/HIGH/NORMAL/LOW\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 智能重试 - 指数退避，最大3次\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 断点续传 - localStorage持久化\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 预估时间 - 基于历史数据动态预估\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 并发控制 - 最大并发3", options: { fontSize: 11 } }
], { x: 5.3, y: 1.55, w: 4.2, h: 1.5, color: colors.text });

// 认证系统
slide9.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.3, y: 3.4, w: 4.6, h: 1.6, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide9.addText("认证系统 (supabase-config.js)", { x: 0.5, y: 3.5, w: 4.2, h: 0.4, fontSize: 13, bold: true, color: colors.primary });
slide9.addText([
  { text: "• Supabase Auth 集成\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 本地缓存快速恢复 (30分钟有效)\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 多重存储备份", options: { fontSize: 11 } }
], { x: 0.5, y: 3.95, w: 4.2, h: 0.9, color: colors.text });

// 移动端适配
slide9.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 5.1, y: 3.4, w: 4.6, h: 1.6, fill: { color: colors.white },
  shadow: { type: "outer", color: "000000", blur: 4, offset: 1, opacity: 0.1 }
});
slide9.addText("移动端适配", { x: 5.3, y: 3.5, w: 4.2, h: 0.4, fontSize: 13, bold: true, color: colors.primary });
slide9.addText([
  { text: "• 自动跳转移动端 → mobile.html\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 响应式设计\n", options: { fontSize: 11, breakLine: true } },
  { text: "• 触控事件支持 (click + touchend)", options: { fontSize: 11 } }
], { x: 5.3, y: 3.95, w: 4.2, h: 0.9, color: colors.text });

// ==================== Slide 10: 功能总结 ====================
let slide10 = pres.addSlide();
slide10.background = { color: colors.dark };

slide10.addText("🎬 功能全景总结", {
  x: 0.5, y: 0.5, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Arial Black", color: colors.white, align: "center"
});

// 六大核心功能
const coreFeatures = [
  { icon: "🎬", title: "视频创作", items: "文生视频/图生视频\n10+ 模型支持\n批量生成队列" },
  { icon: "🎨", title: "图像创作", items: "多模型图片生成\n风格迁移/图生图\nIP角色设计" },
  { icon: "🎙️", title: "音频制作", items: "TTS配音(多引擎)\n多角色配音\nAI音乐生成" },
  { icon: "✍️", title: "文本创作", items: "剧本/文案生成\n长篇小说引擎\n剧情一致性校验" },
  { icon: "🤖", title: "智能体协作", items: "21个专业角色\n10个团队模板\n自动任务调度" },
  { icon: "🧩", title: "技能系统", items: "100+ 预置技能\n自定义技能\n进度跟踪" }
];

coreFeatures.forEach((f, i) => {
  const x = 0.4 + (i % 3) * 3.15;
  const y = 1.3 + Math.floor(i / 3) * 2.0;
  
  slide10.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: y, w: 3.0, h: 1.8, fill: { color: "FFFFFF10", transparency: 90 },
    line: { color: colors.accent, width: 1 }
  });
  slide10.addText(f.icon, { x: x, y: y + 0.1, w: 3.0, h: 0.5, fontSize: 28, align: "center" });
  slide10.addText(f.title, { x: x + 0.1, y: y + 0.55, w: 2.8, h: 0.35, fontSize: 14, bold: true, color: colors.accent, align: "center" });
  slide10.addText(f.items, { x: x + 0.1, y: y + 0.95, w: 2.8, h: 0.75, fontSize: 10, color: colors.white, align: "center" });
});

// 技术栈
slide10.addText("技术栈: 前端(原生JS) + 后端(Vercel Functions) + 数据库(Supabase) + AI(Sora2/Gemini/MJ等)", {
  x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 11, color: colors.textLight, align: "center"
});

// 保存文件
pres.writeFile({ fileName: "RollRoll-AI-项目功能思维导图.pptx" })
  .then(() => console.log("✅ 思维导图PPT已生成: RollRoll-AI-项目功能思维导图.pptx"))
  .catch(err => console.error("❌ 生成失败:", err));
