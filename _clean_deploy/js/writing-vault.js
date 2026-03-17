/**
 * 📚 超长篇写作管理模块 (writing-vault.js)
 *
 * 功能：
 * - 写作项目 CRUD（薄封装 supabase-proxy）
 * - 上下文组装：世界观 + 大纲 + 前章摘要 + 最近正文 → ~1500 token
 * - 章节自动摘要（廉价 LLM 一次性生成）
 * - 本地缓存当前项目，减少网络请求
 */

(function (global) {
    'use strict';

    const CACHE_KEY = 'rollroll_writing_cache';
    const RECENT_TEXT_CHARS = 2000; // 最近正文截取字数
    const SUMMARY_MAX_CHARS = 300; // 摘要最大字数

    // ==================== 内部状态 ====================
    let _currentProjectId = null;
    let _projectCache = {}; // { [projectId]: { project, chapters, loadedAt } }

    // ==================== Supabase Proxy 封装 ====================

    async function _proxy(action, body) {
        const userId = typeof getCurrentUserId === 'function' ? await getCurrentUserId() : null;
        if (!userId) throw new Error('请先登录');

        const res = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, userId, ...body })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            throw new Error(data.message || data.error || `写作操作失败: ${action}`);
        }
        return data;
    }

    // ==================== 项目操作 ====================

    const WritingVault = {

        // ---------- 项目 CRUD ----------

        async createProject(title, projectType, meta) {
            const data = await _proxy('writingCreateProject', {
                title: title || '未命名项目',
                projectType: projectType || 'novel',
                meta: meta || {}
            });
            return data.project;
        },

        async listProjects() {
            const data = await _proxy('writingListProjects', {});
            return data.projects || [];
        },

        async getProject(projectId) {
            const data = await _proxy('writingGetProject', { projectId });
            return data.project;
        },

        async updateProject(projectId, patch) {
            await _proxy('writingUpdateProject', { projectId, ...patch });
        },

        async deleteProject(projectId) {
            await _proxy('writingDeleteProject', { projectId });
            delete _projectCache[projectId];
            if (_currentProjectId === projectId) _currentProjectId = null;
        },

        // ---------- 章节 CRUD ----------

        async listChapters(projectId) {
            const data = await _proxy('writingListChapters', { projectId });
            return data.chapters || [];
        },

        async createChapter(projectId, title, orderIndex) {
            const data = await _proxy('writingCreateChapter', {
                projectId,
                title: title || '新章节',
                orderIndex: typeof orderIndex === 'number' ? orderIndex : 9999
            });
            return data.chapter;
        },

        async getChapter(chapterId) {
            const data = await _proxy('writingGetChapter', { chapterId });
            return data.chapter;
        },

        async updateChapter(chapterId, patch) {
            await _proxy('writingUpdateChapter', { chapterId, ...patch });
        },

        async deleteChapter(chapterId) {
            await _proxy('writingDeleteChapter', { chapterId });
        },

        // ---------- 导出 ----------

        async exportProject(projectId, format) {
            const data = await _proxy('writingExportUpload', {
                projectId,
                format: format || 'md'
            });
            return data;
        },

        // ---------- 协作 ----------

        async createInvite(projectId, role) {
            const data = await _proxy('writingCreateInvite', {
                projectId,
                role: role || 'editor'
            });
            return data;
        },

        async acceptInvite(token) {
            const data = await _proxy('writingAcceptInvite', { token });
            return data;
        },

        // ==================== 上下文组装（核心） ====================

        /**
         * 🔑 组装写作上下文，注入 LLM system prompt
         * 约 1000-1500 token
         *
         * @param {string} projectId
         * @param {number|null} currentChapterIndex - 当前正在写的章节序号（0-based）
         * @returns {Promise<string>} 上下文字符串
         */
        async assembleContext(projectId, currentChapterIndex) {
            // 1. 获取项目信息
            let project = _projectCache[projectId]?.project;
            if (!project) {
                project = await this.getProject(projectId);
                if (!_projectCache[projectId]) _projectCache[projectId] = {};
                _projectCache[projectId].project = project;
            }
            if (!project) throw new Error('项目不存在');

            // 2. 获取章节列表
            let chapters = _projectCache[projectId]?.chapters;
            const cacheAge = _projectCache[projectId]?.loadedAt || 0;
            if (!chapters || Date.now() - cacheAge > 60000) { // 1分钟缓存
                chapters = await this.listChapters(projectId);
                _projectCache[projectId].chapters = chapters;
                _projectCache[projectId].loadedAt = Date.now();
            }

            const meta = project.meta || {};
            const parts = [];

            // 3. 世界观 + 角色表（~400 token）
            if (meta.worldSetting || meta.world_setting) {
                const world = String(meta.worldSetting || meta.world_setting || '').slice(0, 600);
                parts.push(`[世界观] ${world}`);
            }
            if (meta.characters) {
                let charText = '';
                if (typeof meta.characters === 'string') {
                    charText = meta.characters.slice(0, 400);
                } else if (Array.isArray(meta.characters)) {
                    charText = meta.characters.map(c =>
                        typeof c === 'string' ? c : `${c.name || ''}(${c.desc || c.description || ''})`
                    ).join('、').slice(0, 400);
                }
                if (charText) parts.push(`[角色] ${charText}`);
            }

            // 4. 大纲（~200 token）
            if (meta.outline) {
                parts.push(`[大纲] ${String(meta.outline).slice(0, 400)}`);
            }

            // 5. 前一章摘要（~150 token）
            const chIdx = typeof currentChapterIndex === 'number' ? currentChapterIndex : chapters.length - 1;
            if (chIdx > 0 && chapters[chIdx - 1]) {
                const prevChapter = chapters[chIdx - 1];
                const prevSummary = prevChapter.summary || '';
                if (prevSummary) {
                    parts.push(`[前章:${prevChapter.title || ''}] ${prevSummary.slice(0, SUMMARY_MAX_CHARS)}`);
                }
            }

            // 6. 当前章摘要（写到一半时）
            if (chapters[chIdx] && chapters[chIdx].summary) {
                parts.push(`[本章摘要] ${chapters[chIdx].summary.slice(0, SUMMARY_MAX_CHARS)}`);
            }

            // 7. 最近正文（当前章末尾 ~600 token）
            if (chapters[chIdx] && chapters[chIdx].content) {
                const fullContent = String(chapters[chIdx].content);
                const recentText = fullContent.length > RECENT_TEXT_CHARS
                    ? '...' + fullContent.slice(-RECENT_TEXT_CHARS)
                    : fullContent;
                if (recentText.trim()) {
                    parts.push(`[最近正文] ${recentText}`);
                }
            }

            if (parts.length === 0) return '';
            return parts.join('\n');
        },

        // ==================== 章节自动摘要 ====================

        /**
         * 🤖 为章节生成摘要 + 关键事件（一次 LLM 调用，~1胶片）
         * @param {string} chapterId
         * @returns {Promise<{summary: string, keyEvents: string[]}>}
         */
        async summarizeChapter(chapterId) {
            const chapter = await this.getChapter(chapterId);
            if (!chapter || !chapter.content) throw new Error('章节内容为空');

            const content = String(chapter.content);
            // 截取前6000字（约3000 token）用于摘要
            const textForSummary = content.length > 6000 ? content.slice(0, 6000) + '...(后续省略)' : content;

            const prompt = `请为以下章节内容生成：
1. 约200字的内容摘要
2. 3-5个关键事件（每个一句话）

章节标题：${chapter.title || ''}
正文：
${textForSummary}

请用以下JSON格式返回：
{"summary":"摘要内容","key_events":["事件1","事件2","事件3"]}`;

            let result;
            if (typeof callWriterLLM === 'function') {
                const raw = await callWriterLLM([
                    { role: 'system', content: '你是小说编辑助手。请精确提取章节摘要和关键事件。直接返回JSON。' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.3, max_tokens: 1024 });
                try {
                    // 尝试从回复中提取 JSON
                    const jsonMatch = raw.match(/\{[\s\S]*\}/);
                    result = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: raw.slice(0, 300), key_events: [] };
                } catch (e) {
                    result = { summary: raw.slice(0, 300), key_events: [] };
                }
            } else {
                throw new Error('写作LLM不可用');
            }

            const summary = String(result.summary || '').slice(0, 500);
            const keyEvents = Array.isArray(result.key_events) ? result.key_events.map(String).slice(0, 10) : [];

            // 更新章节摘要
            await this.updateChapter(chapterId, {
                summary,
                keyEvents,
                wordCount: content.length
            });

            // 更新缓存
            if (_projectCache[chapter.project_id]?.chapters) {
                const cached = _projectCache[chapter.project_id].chapters.find(c => c.id === chapterId);
                if (cached) {
                    cached.summary = summary;
                    cached.key_events = keyEvents;
                    cached.word_count = content.length;
                }
            }

            console.log(`📚 [WritingVault] 章节摘要已生成: ${summary.slice(0, 50)}...`);
            return { summary, keyEvents };
        },

        // ==================== 回溯检索 ====================

        /**
         * 🔍 查询某章节内容并回答用户问题
         * @param {string} chapterId
         * @param {string} question
         * @returns {Promise<string>}
         */
        async queryChapter(chapterId, question) {
            const chapter = await this.getChapter(chapterId);
            if (!chapter || !chapter.content) throw new Error('章节内容为空');

            const content = String(chapter.content);
            // 截取前8000字（约4000 token）
            const textForQuery = content.length > 8000
                ? content.slice(0, 4000) + '\n...(中间省略)...\n' + content.slice(-4000)
                : content;

            if (typeof callWriterLLM !== 'function') throw new Error('写作LLM不可用');

            return await callWriterLLM([
                { role: 'system', content: '你是小说阅读助手。根据给定的章节内容回答用户的问题。如果内容中找不到答案，请如实告知。' },
                { role: 'user', content: `章节「${chapter.title || ''}」内容:\n${textForQuery}\n\n用户问题: ${question}` }
            ], { temperature: 0.3, max_tokens: 2048 });
        },

        // ==================== 工具方法 ====================

        /** 设置当前活动项目 */
        setCurrentProject(projectId) {
            _currentProjectId = projectId;
        },

        /** 获取当前活动项目ID */
        getCurrentProjectId() {
            return _currentProjectId;
        },

        /** 清除缓存 */
        clearCache(projectId) {
            if (projectId) {
                delete _projectCache[projectId];
            } else {
                _projectCache = {};
            }
        }
    };

    // ==================== 导出 ====================
    global.WritingVault = WritingVault;

    console.log('📚 [writing-vault.js] 写作管理模块已加载');

})(typeof window !== 'undefined' ? window : this);
