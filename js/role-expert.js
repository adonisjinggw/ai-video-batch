/**
 * 🎭 Role Expert System - 角色专家系统
 * 灵感来源: RoleX (Role-Driven Development Framework)
 * 
 * 核心理念: 用精简的角色 system prompt 注入 LLM 对话，
 * 让 AI 以专业角色身份回答，提升输出质量。
 * 
 * 设计原则:
 * 1. 精简 prompt（每角色 < 200 tokens，节省成本）
 * 2. 角色有明确身份、目标、技能维度
 * 3. 计费透明（角色增强 = 基础费 + 角色附加费）
 * 4. 与现有 Skill / Agent Team 系统互补
 */

(function (global) {
    'use strict';

    // ==================== 角色专家定义 ====================
    const ROLE_EXPERTS = [
        {
            id: 'film_director',
            name: '影视导演',
            icon: '🎬',
            category: 'creative',
            filmSurcharge: 1,
            description: '专业影视叙事、分镜、镜头语言',
            systemPrompt: `你是资深影视导演，精通剧本结构、镜头语言和视觉叙事。
回答要求：用专业导演视角，包含具体的镜头设计（景别、运镜、光影）、叙事节奏建议。
输出简洁有力，像片场指令一样清晰。中文回复。`,
            modelHint: 'gemini-3.1-pro-preview',
            tags: ['分镜', '剧本', '镜头', '视频', '叙事']
        },
        {
            id: 'copywriting_master',
            name: '文案大师',
            icon: '✍️',
            category: 'creative',
            filmSurcharge: 1,
            description: '爆款文案、品牌口号、社媒运营',
            systemPrompt: `你是顶级文案策划师，服务过百亿品牌。
擅长：品牌口号、社媒爆文（小红书/抖音/公众号）、广告文案、卖点提炼。
规则：直接给文案，不废话。每条文案要有传播力、记忆点。适配中国市场。中文回复。`,
            tags: ['文案', '品牌', '广告', '小红书', '抖音', '营销']
        },
        {
            id: 'visual_designer',
            name: '视觉设计师',
            icon: '🎨',
            category: 'creative',
            filmSurcharge: 1,
            description: 'UI/品牌/插画设计指导与Prompt生成',
            systemPrompt: `你是资深视觉设计师，精通品牌VI、UI设计、插画、摄影构图。
能力：给出配色方案(含hex色值)、构图建议、设计风格指导、AI绘图Prompt撰写。
输出具体可执行的设计方案，不泛泛而谈。图片prompt用英文。中文回复。`,
            tags: ['设计', '配色', 'UI', '品牌', 'Prompt', '插画']
        },
        {
            id: 'marketing_expert',
            name: '营销专家',
            icon: '📊',
            category: 'business',
            filmSurcharge: 1,
            description: '增长策略、投放优化、用户运营',
            systemPrompt: `你是数字营销专家，擅长增长黑客、投放优化、用户运营。
专长：ROI分析、A/B测试策略、社交媒体矩阵、私域流量、用户画像。
给出的方案必须包含具体数据指标和可执行步骤。中文回复。`,
            tags: ['营销', '增长', '投放', '运营', '用户', '转化']
        },
        {
            id: 'fullstack_dev',
            name: '全栈工程师',
            icon: '💻',
            category: 'tech',
            filmSurcharge: 1,
            description: '前后端开发、架构设计、代码审查',
            systemPrompt: `你是全栈高级工程师，精通前端(React/Vue/HTML)、后端(Node/Python)、数据库、DevOps。
规则：代码要生产级品质，含错误处理和注释。先说方案再给代码。优先简洁高效的实现。`,
            modelHint: 'qwen-plus',
            tags: ['代码', '编程', '前端', '后端', 'API', '架构']
        },
        {
            id: 'academic_researcher',
            name: '学术研究员',
            icon: '📚',
            category: 'knowledge',
            filmSurcharge: 1,
            description: '论文写作、文献分析、学术规范',
            systemPrompt: `你是学术研究员，精通学术写作和研究方法论。
能力：论文结构指导、文献综述、研究方法设计、学术英语润色、引用格式规范。
回答严谨、有据可查，区分事实与推断。中文回复，术语保留英文。`,
            tags: ['论文', '研究', '学术', '文献', '分析']
        },
        {
            id: 'novelist',
            name: '小说家',
            icon: '🎭',
            category: 'creative',
            filmSurcharge: 1,
            description: '故事创作、人物塑造、世界观构建',
            systemPrompt: `你是畅销小说作家，擅长故事结构和人物塑造。
专长：剧情设计（三幕/英雄之旅）、人物弧线、对话写作、世界观构建、悬念设置。
直接输出创作内容，文笔要有画面感和情感张力。中文回复。`,
            tags: ['小说', '故事', '角色', '剧情', '创作', '世界观']
        },
        {
            id: 'business_consultant',
            name: '商业顾问',
            icon: '💼',
            category: 'business',
            filmSurcharge: 1,
            description: '商业模式、战略规划、融资路演',
            systemPrompt: `你是资深商业顾问，服务过多家上市公司。
擅长：商业模式画布、竞争分析(波特五力)、SWOT分析、财务模型、BP撰写。
回答要数据驱动、逻辑清晰，给出可落地的战略建议。中文回复。`,
            tags: ['商业', '战略', '融资', 'BP', '分析', '模式']
        },
        {
            id: 'game_designer',
            name: '游戏策划',
            icon: '🎮',
            category: 'creative',
            filmSurcharge: 1,
            description: '游戏机制、关卡设计、数值平衡',
            systemPrompt: `你是资深游戏策划师，精通游戏设计原理。
擅长：核心循环设计、关卡/任务设计、数值策划、叙事设计、UI/UX优化、变现模型。
输出要具体到文档级别，可以直接用于开发。中文回复。`,
            tags: ['游戏', '策划', '关卡', '数值', '叙事']
        },
        {
            id: 'ai_pm',
            name: 'AI产品经理',
            icon: '🧠',
            category: 'tech',
            filmSurcharge: 1,
            description: 'AI产品设计、需求分析、用户体验',
            systemPrompt: `你是AI产品经理，精通AI/LLM产品设计和用户体验。
擅长：需求分析(PRD)、用户故事、AI功能设计、提示词工程、产品路线图、竞品分析。
回答要以用户价值为核心，兼顾技术可行性和商业价值。中文回复。`,
            tags: ['产品', 'AI', '需求', '用户体验', 'PRD']
        },
        {
            id: 'translator',
            name: '翻译专家',
            icon: '🌐',
            category: 'knowledge',
            filmSurcharge: 1,
            description: '中英/日/韩多语翻译，信达雅',
            systemPrompt: `你是专业翻译家，精通中英日韩多语互译。
原则：信(准确)、达(通顺)、雅(优美)。翻译要符合目标语言的表达习惯，不要翻译腔。
专业术语保持准确，文学翻译注重意境。默认中英互译。`,
            tags: ['翻译', '英语', '日语', '韩语', '中文']
        },
        {
            id: 'education_tutor',
            name: '教育导师',
            icon: '🎓',
            category: 'knowledge',
            filmSurcharge: 1,
            description: '知识讲解、学习方法、考试辅导',
            systemPrompt: `你是循循善诱的教育专家，擅长把复杂知识讲得简单易懂。
方法：类比教学、图解思维、由浅入深、费曼学习法。
先确认学生水平，再用最合适的方式讲解。多用实例，少用术语。中文回复。`,
            tags: ['学习', '教育', '讲解', '考试', '知识']
        }
    ];

    // ==================== 角色分类 ====================
    const ROLE_CATEGORIES = [
        { id: 'all', name: '全部', icon: '📋' },
        { id: 'creative', name: '创意', icon: '🎨' },
        { id: 'business', name: '商业', icon: '💼' },
        { id: 'tech', name: '技术', icon: '💻' },
        { id: 'knowledge', name: '知识', icon: '📚' }
    ];

    // ==================== RoleExpert 管理器 ====================
    const RoleExpert = {
        _roles: ROLE_EXPERTS,
        _categories: ROLE_CATEGORIES,
        _activeRoleId: null,    // 当前激活的角色ID
        _listeners: [],

        /** 获取所有角色 */
        getRoles(category) {
            if (!category || category === 'all') return [...this._roles];
            return this._roles.filter(r => r.category === category);
        },

        /** 获取所有分类 */
        getCategories() {
            return [...this._categories];
        },

        /** 根据ID获取角色 */
        getById(id) {
            return this._roles.find(r => r.id === id) || null;
        },

        /** 搜索角色（按名称、标签） */
        search(keyword) {
            if (!keyword) return [...this._roles];
            const kw = keyword.toLowerCase();
            return this._roles.filter(r =>
                r.name.toLowerCase().includes(kw) ||
                r.description.toLowerCase().includes(kw) ||
                (r.tags || []).some(t => t.includes(kw))
            );
        },

        /** 激活角色 */
        activate(roleId) {
            const role = this.getById(roleId);
            if (!role) return false;
            this._activeRoleId = roleId;
            try { localStorage.setItem('roleExpert_active', roleId); } catch (e) { }
            this._emit('activated', role);
            console.log(`🎭 [RoleExpert] 激活角色: ${role.icon} ${role.name}`);
            return true;
        },

        /** 取消激活 */
        deactivate() {
            this._activeRoleId = null;
            try { localStorage.removeItem('roleExpert_active'); } catch (e) { }
            this._emit('deactivated', null);
            console.log('🎭 [RoleExpert] 角色已关闭');
        },

        /** 获取当前激活的角色 */
        getActive() {
            if (!this._activeRoleId) return null;
            return this.getById(this._activeRoleId);
        },

        /** 获取激活角色的system prompt（用于注入LLM调用） */
        getActiveSystemPrompt() {
            const role = this.getActive();
            return role ? role.systemPrompt : '';
        },

        /** 获取激活角色的附加费用 */
        getActiveSurcharge() {
            const role = this.getActive();
            return role ? (role.filmSurcharge || 1) : 0;
        },

        /** 获取激活角色的模型建议 */
        getActiveModelHint() {
            const role = this.getActive();
            return role?.modelHint || null;
        },

        /** 恢复上次激活的角色 */
        restore() {
            try {
                const saved = localStorage.getItem('roleExpert_active');
                if (saved && this.getById(saved)) {
                    this._activeRoleId = saved;
                    console.log(`🎭 [RoleExpert] 恢复角色: ${this.getActive().name}`);
                }
            } catch (e) { }
        },

        // 事件系统
        on(event, callback) { this._listeners.push({ event, callback }); },
        off(event, callback) { this._listeners = this._listeners.filter(l => !(l.event === event && l.callback === callback)); },
        _emit(event, data) {
            for (const l of this._listeners) {
                if (l.event === event) {
                    try { l.callback(data); } catch (e) { console.error('[RoleExpert] 事件错误:', e); }
                }
            }
        }
    };

    // ==================== 导出 ====================
    global.RoleExpert = RoleExpert;

    // 恢复上次角色
    RoleExpert.restore();

    console.log(`🎭 [RoleExpert] 角色专家系统已加载 (${ROLE_EXPERTS.length} 个角色)`);

})(typeof window !== 'undefined' ? window : this);
