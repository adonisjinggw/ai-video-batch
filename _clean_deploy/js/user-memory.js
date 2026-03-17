/**
 * 🧠 用户长期记忆模块 (user-memory.js)
 * 
 * 功能：
 * - 采集用户偏好（画风、模型、比例、技能使用等），零 token 成本
 * - localStorage 缓存 + Supabase 云端同步
 * - getUserMemoryPrompt() 返回 ~50-80 token 紧凑字符串，注入 LLM system prompt
 */

(function (global) {
    'use strict';

    const STORAGE_KEY = 'rollroll_user_memory';
    const SYNC_INTERVAL = 5 * 60 * 1000; // 5分钟同步一次
    const MAX_ARRAY_LEN = 20; // 每类偏好最多保留20条

    // ==================== 记忆数据结构 ====================
    let _memory = null;
    let _dirty = false;
    let _syncTimer = null;
    let _lastSync = 0;

    function _defaultMemory() {
        return {
            version: 1,
            styles: [],        // 常用画风 [{name, count}]
            topics: [],        // 常做主题 [{name, count}]
            characters: [],    // 角色名 [{name, count}]
            ratios: {},        // 比例偏好计数 { '16:9': 5, '9:16': 3 }
            skills: {},        // 技能使用频次 { 'batch_short_video': 10 }
            models: {          // 模型偏好
                image: {},     // { 'nano-banana-2': 5, 'midjourney-fast': 2 }
                video: {},     // { 'sora-2-all': 8 }
                text: {}       // { 'gemini-3-pro-preview': 3 }
            },
            notes: '',         // LLM摘要的自由记忆（未来扩展）
            updatedAt: null
        };
    }

    // ==================== 加载 / 保存 ====================

    /** 从 localStorage 加载（同步，毫秒级） */
    function _loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    _memory = { ..._defaultMemory(), ...parsed };
                    return;
                }
            }
        } catch (e) {
            console.warn('[UserMemory] localStorage 读取失败:', e);
        }
        _memory = _defaultMemory();
    }

    /** 保存到 localStorage */
    function _saveLocal() {
        try {
            _memory.updatedAt = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_memory));
        } catch (e) {
            console.warn('[UserMemory] localStorage 保存失败:', e);
        }
    }

    /** 从 Supabase 拉取（异步） */
    async function _pullFromCloud() {
        try {
            const userId = typeof getCurrentUserId === 'function' ? await getCurrentUserId() : null;
            if (!userId) return;

            const res = await fetch('/api/supabase-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getUserMemory', userId })
            });
            const data = await res.json().catch(() => ({}));
            if (data.success && data.memory && data.memory.data) {
                const cloud = data.memory.data;
                // 合并：云端数据补充本地缺失的部分（以本地为主，因为本地更新更频繁）
                _mergeCloud(cloud);
                _saveLocal();
                console.log('🧠 [UserMemory] 已从云端同步');
            }
        } catch (e) {
            console.warn('[UserMemory] 云端拉取失败:', e);
        }
    }

    /** 推送到 Supabase */
    async function _pushToCloud() {
        if (!_dirty) return;
        try {
            const userId = typeof getCurrentUserId === 'function' ? await getCurrentUserId() : null;
            if (!userId) return;

            await fetch('/api/supabase-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveUserMemory',
                    userId,
                    data: _memory
                })
            });
            _dirty = false;
            _lastSync = Date.now();
            console.log('🧠 [UserMemory] 已推送到云端');
        } catch (e) {
            console.warn('[UserMemory] 云端推送失败:', e);
        }
    }

    /** 合并云端数据（取并集，计数取最大值） */
    function _mergeCloud(cloud) {
        if (!cloud || typeof cloud !== 'object') return;

        // 合并数组类（styles, topics, characters）
        for (const key of ['styles', 'topics', 'characters']) {
            if (Array.isArray(cloud[key])) {
                const localMap = new Map((_memory[key] || []).map(i => [i.name, i.count || 1]));
                for (const item of cloud[key]) {
                    const name = item.name || item;
                    const count = item.count || 1;
                    localMap.set(name, Math.max(localMap.get(name) || 0, count));
                }
                _memory[key] = Array.from(localMap.entries())
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, MAX_ARRAY_LEN);
            }
        }

        // 合并对象类（ratios, skills）
        for (const key of ['ratios', 'skills']) {
            if (cloud[key] && typeof cloud[key] === 'object') {
                for (const [k, v] of Object.entries(cloud[key])) {
                    _memory[key][k] = Math.max(_memory[key][k] || 0, Number(v) || 0);
                }
            }
        }

        // 合并 models
        if (cloud.models && typeof cloud.models === 'object') {
            for (const cat of ['image', 'video', 'text']) {
                if (cloud.models[cat]) {
                    if (!_memory.models[cat]) _memory.models[cat] = {};
                    for (const [k, v] of Object.entries(cloud.models[cat])) {
                        _memory.models[cat][k] = Math.max(_memory.models[cat][k] || 0, Number(v) || 0);
                    }
                }
            }
        }

        // notes 取较长的那个
        if (cloud.notes && (!_memory.notes || cloud.notes.length > _memory.notes.length)) {
            _memory.notes = cloud.notes;
        }
    }

    // ==================== 偏好采集（零 token） ====================

    /** 通用计数器：数组类型 [{name, count}] */
    function _incrementArray(key, value) {
        if (!value || typeof value !== 'string') return;
        const val = value.trim();
        if (!val) return;

        if (!Array.isArray(_memory[key])) _memory[key] = [];
        const existing = _memory[key].find(i => i.name === val);
        if (existing) {
            existing.count = (existing.count || 1) + 1;
        } else {
            _memory[key].push({ name: val, count: 1 });
        }
        // 按频次排序 + 截断
        _memory[key].sort((a, b) => b.count - a.count);
        if (_memory[key].length > MAX_ARRAY_LEN) {
            _memory[key] = _memory[key].slice(0, MAX_ARRAY_LEN);
        }
        _dirty = true;
        _saveLocal();
    }

    /** 通用计数器：对象类型 { key: count } */
    function _incrementObj(category, key) {
        if (!key || typeof key !== 'string') return;
        const k = key.trim();
        if (!k) return;

        if (typeof _memory[category] !== 'object' || _memory[category] === null) {
            _memory[category] = {};
        }
        _memory[category][k] = (_memory[category][k] || 0) + 1;
        _dirty = true;
        _saveLocal();
    }

    // ==================== 公共 API ====================

    const UserMemory = {
        /** 初始化：加载本地缓存 + 异步拉取云端 */
        init() {
            _loadLocal();
            // 延迟拉取云端，不阻塞页面加载
            setTimeout(() => _pullFromCloud(), 3000);
            // 定时推送
            _syncTimer = setInterval(() => {
                if (_dirty && Date.now() - _lastSync > SYNC_INTERVAL) {
                    _pushToCloud();
                }
            }, SYNC_INTERVAL);
            console.log('🧠 [UserMemory] 已初始化');
        },

        /** 记录技能使用 */
        recordSkillUse(skillId, params) {
            if (!_memory) _loadLocal();
            if (!skillId) return;

            _incrementObj('skills', skillId);

            // 提取参数中的偏好
            if (params && typeof params === 'object') {
                if (params.style) _incrementArray('styles', params.style);
                if (params.videoModel) _incrementObj('models', params.videoModel); // 兼容旧调用
                if (params.imageModel) {
                    if (!_memory.models) _memory.models = {};
                    if (!_memory.models.image) _memory.models.image = {};
                    _memory.models.image[params.imageModel] = (_memory.models.image[params.imageModel] || 0) + 1;
                    _dirty = true;
                    _saveLocal();
                }
                if (params.videoModel) {
                    if (!_memory.models) _memory.models = {};
                    if (!_memory.models.video) _memory.models.video = {};
                    _memory.models.video[params.videoModel] = (_memory.models.video[params.videoModel] || 0) + 1;
                    _dirty = true;
                    _saveLocal();
                }
                if (params.aspectRatio || params.ratio) {
                    _incrementObj('ratios', params.aspectRatio || params.ratio);
                }
            }
        },

        /** 记录角色创建 */
        recordCharacter(name) {
            if (!_memory) _loadLocal();
            _incrementArray('characters', name);
        },

        /** 记录主题（从用户输入中提取） */
        recordTopic(topic) {
            if (!_memory) _loadLocal();
            _incrementArray('topics', topic);
        },

        /** 记录模型使用（通用） */
        recordModel(category, modelName) {
            if (!_memory) _loadLocal();
            if (!modelName) return;
            if (!_memory.models) _memory.models = {};
            if (!_memory.models[category]) _memory.models[category] = {};
            _memory.models[category][modelName] = (_memory.models[category][modelName] || 0) + 1;
            _dirty = true;
            _saveLocal();
        },

        /** 获取完整记忆数据 */
        getData() {
            if (!_memory) _loadLocal();
            return _memory;
        },

        /** 强制同步到云端 */
        async sync() {
            await _pushToCloud();
        },

        /**
         * 🔑 核心函数：获取用户记忆提示词（注入 LLM system prompt）
         * 返回 ~50-80 token 的紧凑中文字符串
         */
        getPrompt() {
            if (!_memory) _loadLocal();

            const parts = [];

            // 画风偏好（top 3）
            const topStyles = (_memory.styles || []).slice(0, 3).map(s => s.name);
            if (topStyles.length) parts.push('画风:' + topStyles.join('/'));

            // 主题偏好（top 3）
            const topTopics = (_memory.topics || []).slice(0, 3).map(t => t.name);
            if (topTopics.length) parts.push('主题:' + topTopics.join('/'));

            // 角色（top 3）
            const topChars = (_memory.characters || []).slice(0, 3).map(c => c.name);
            if (topChars.length) parts.push('角色:' + topChars.join('/'));

            // 比例偏好（top 1）
            const ratioEntries = Object.entries(_memory.ratios || {}).sort((a, b) => b[1] - a[1]);
            if (ratioEntries.length) parts.push('比例:' + ratioEntries[0][0]);

            // 常用技能（top 2）
            const SKILL_NAMES = {
                'batch_short_video': '短视频批量',
                'style_consistent_images': '风格统一图',
                'character_design_pack': '角色设计',
                'comic_storyboard': '漫画分镜',
                'product_showcase': '商品展示',
                'full_auto_workflow': '全自动工坊'
            };
            const skillEntries = Object.entries(_memory.skills || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
            if (skillEntries.length) {
                const names = skillEntries.map(([k]) => SKILL_NAMES[k] || k);
                parts.push('常用:' + names.join('/'));
            }

            // 模型偏好
            const imgModels = Object.entries((_memory.models && _memory.models.image) || {}).sort((a, b) => b[1] - a[1]);
            const vidModels = Object.entries((_memory.models && _memory.models.video) || {}).sort((a, b) => b[1] - a[1]);
            if (imgModels.length) parts.push('生图:' + imgModels[0][0]);
            if (vidModels.length) parts.push('生视频:' + vidModels[0][0]);

            // notes
            if (_memory.notes) parts.push(_memory.notes);

            if (parts.length === 0) return '';
            return '[用户偏好] ' + parts.join(' ');
        },

        /** 页面卸载时保存 */
        flush() {
            _saveLocal();
            // 尝试 sendBeacon 异步推送
            if (_dirty && navigator.sendBeacon) {
                try {
                    const userId = localStorage.getItem('rollroll_user_id') || '';
                    if (userId) {
                        navigator.sendBeacon('/api/supabase-proxy', JSON.stringify({
                            action: 'saveUserMemory',
                            userId,
                            data: _memory
                        }));
                    }
                } catch (e) { /* ignore */ }
            }
        }
    };

    // ==================== 自动初始化 ====================
    // 延迟初始化，等 supabase-config 等依赖加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UserMemory.init());
    } else {
        setTimeout(() => UserMemory.init(), 100);
    }

    // 页面关闭时保存
    window.addEventListener('beforeunload', () => UserMemory.flush());

    // 导出
    global.UserMemory = UserMemory;
    // 便捷全局函数
    global.getUserMemoryPrompt = function () {
        return UserMemory.getPrompt();
    };

    console.log('🧠 [user-memory.js] 用户记忆模块已加载');

})(typeof window !== 'undefined' ? window : this);
