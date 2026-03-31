/**
 * ==================== 小卷助手记忆系统 ====================
 * 基于 Supabase 的持久化用户偏好记忆
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        memoryKey: 'xiaobiao_memory',
        maxMemories: 100,
        syncInterval: 30000 // 30秒同步一次
    };

    // ==================== 记忆类型 ====================
    const MEMORY_TYPES = {
        PREFERENCE: 'preference',    // 用户偏好 (如：喜欢动漫风格)
        CONTEXT: 'context',          // 上下文记忆 (如：正在做XX项目)
        FREQUENCY: 'frequency',      // 频率统计 (如：常用功能)
        FEEDBACK: 'feedback',        // 反馈记录 (如：不喜欢XX效果)
        CUSTOM: 'custom'             // 自定义记忆
    };

    // ==================== 记忆存储 ====================
    class AssistantMemory {
        constructor() {
            this.memories = {};
            this.localCache = this.loadLocalCache();
            this.syncTimer = null;
            this.isSyncing = false;
        }

        /**
         * 初始化记忆系统
         */
        async init(supabase) {
            this.supabase = supabase;

            // 获取用户ID
            const { data } = await this.supabase.auth.getSession();
            if (data?.user?.id) {
                this.userId = data.user.id;
                await this.loadRemoteMemories();
            }

            // 启动自动同步
            this.startAutoSync();

            console.log('[记忆系统] 初始化完成');
        }

        /**
         * 记忆一个事实
         * @param {string} type - 记忆类型
         * @param {string} key - 记忆键
         * @param {any} value - 记忆值
         * @param {object} metadata - 元数据
         */
        async remember(type, key, value, metadata = {}) {
            const memoryKey = `${type}:${key}`;
            const memory = {
                type,
                key,
                value,
                metadata,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                accessCount: 0
            };

            // 更新本地缓存
            this.localCache[memoryKey] = memory;
            this.saveLocalCache();

            // 更新内部记忆
            this.memories[memoryKey] = memory;

            // 异步同步到服务器
            this.syncMemory(memory);

            console.log(`[记忆系统] 记住: ${memoryKey} =`, value);
        }

        /**
         * 回忆一个事实
         * @param {string} type - 记忆类型
         * @param {string} key - 记忆键
         * @returns {any} 记忆的值，不存在返回 null
         */
        recall(type, key) {
            const memoryKey = `${type}:${key}`;
            const memory = this.localCache[memoryKey] || this.memories[memoryKey];

            if (memory) {
                // 更新访问计数
                memory.accessCount = (memory.accessCount || 0) + 1;
                memory.lastAccessedAt = Date.now();

                console.log(`[记忆系统] 回忆: ${memoryKey} =`, memory.value);
                return memory.value;
            }

            console.log(`[记忆系统] 没有关于 ${memoryKey} 的记忆`);
            return null;
        }

        /**
         * 遗忘一个事实
         * @param {string} type - 记忆类型
         * @param {string} key - 记忆键
         */
        async forget(type, key) {
            const memoryKey = `${type}:${key}`;

            delete this.localCache[memoryKey];
            this.saveLocalCache();
            delete this.memories[memoryKey];

            // 从服务器删除
            await this.deleteRemoteMemory(memoryKey);

            console.log(`[记忆系统] 遗忘: ${memoryKey}`);
        }

        /**
         * 获取某类型的所有记忆
         * @param {string} type - 记忆类型
         * @returns {Array} 记忆列表
         */
        getByType(type) {
            const prefix = `${type}:`;
            return Object.entries(this.localCache)
                .filter(([key]) => key.startsWith(prefix))
                .map(([key, memory]) => ({ key, ...memory }));
        }

        /**
         * 搜索记忆
         * @param {string} query - 搜索关键词
         * @returns {Array} 匹配的记忆列表
         */
        search(query) {
            const lowerQuery = query.toLowerCase();
            return Object.entries(this.localCache)
                .filter(([key, memory]) => {
                    return key.toLowerCase().includes(lowerQuery) ||
                           JSON.stringify(memory.value).toLowerCase().includes(lowerQuery);
                })
                .map(([key, memory]) => ({ key, ...memory }));
        }

        /**
         * 记录用户偏好
         */
        async setPreference(key, value, category = 'general') {
            await this.remember(MEMORY_TYPES.PREFERENCE, key, value, { category });
        }

        /**
         * 获取用户偏好
         */
        getPreference(key, defaultValue = null) {
            return this.recall(MEMORY_TYPES.PREFERENCE, key) ?? defaultValue;
        }

        /**
         * 记录功能使用频率
         */
        async trackUsage(feature, action = 'use') {
            const key = `${feature}:${action}`;
            const current = this.recall(MEMORY_TYPES.FREQUENCY, key) || { count: 0, lastUsed: 0 };
            await this.remember(MEMORY_TYPES.FREQUENCY, key, {
                count: current.count + 1,
                lastUsed: Date.now(),
                feature,
                action
            });
        }

        /**
         * 获取最常用的功能
         */
        getTopFeatures(limit = 5) {
            const features = this.getByType(MEMORY_TYPES.FREQUENCY);
            return features
                .sort((a, b) => (b.value?.count || 0) - (a.value?.count || 0))
                .slice(0, limit);
        }

        /**
         * 记录用户反馈
         */
        async recordFeedback(target, sentiment, comment = '') {
            await this.remember(MEMORY_TYPES.FEEDBACK, `${target}_${Date.now()}`, {
                target,
                sentiment, // 'positive' | 'negative' | 'neutral'
                comment,
                timestamp: Date.now()
            });
        }

        /**
         * 加载本地缓存
         */
        loadLocalCache() {
            try {
                const cached = localStorage.getItem(CONFIG.memoryKey);
                return cached ? JSON.parse(cached) : {};
            } catch (e) {
                console.warn('[记忆系统] 加载本地缓存失败:', e);
                return {};
            }
        }

        /**
         * 保存本地缓存
         */
        saveLocalCache() {
            try {
                // 只保存最近的记忆
                const entries = Object.entries(this.localCache);
                if (entries.length > CONFIG.maxMemories) {
                    // 按访问时间排序，保留最常用的
                    entries.sort((a, b) => (b[1]?.accessCount || 0) - (a[1]?.accessCount || 0));
                    const toKeep = entries.slice(0, CONFIG.maxMemories);
                    this.localCache = Object.fromEntries(toKeep);
                }
                localStorage.setItem(CONFIG.memoryKey, JSON.stringify(this.localCache));
            } catch (e) {
                console.warn('[记忆系统] 保存本地缓存失败:', e);
            }
        }

        /**
         * 从服务器加载记忆
         */
        async loadRemoteMemories() {
            if (!this.userId || !this.supabase) return;

            try {
                const { data, error } = await this.supabase
                    .from('user_assistant_memory')
                    .select('*')
                    .eq('user_id', this.userId)
                    .order('updated_at', { ascending: false })
                    .limit(CONFIG.maxMemories);

                if (error) throw error;

                // 合并到本地缓存
                if (data) {
                    for (const row of data) {
                        const memoryKey = `${row.memory_type}:${row.memory_key}`;
                        this.localCache[memoryKey] = {
                            type: row.memory_type,
                            key: row.memory_key,
                            value: row.memory_value,
                            metadata: row.metadata || {},
                            createdAt: new Date(row.created_at).getTime(),
                            updatedAt: new Date(row.updated_at).getTime(),
                            synced: true
                        };
                    }
                    this.saveLocalCache();
                }

                console.log(`[记忆系统] 从服务器加载 ${data?.length || 0} 条记忆`);
            } catch (e) {
                console.error('[记忆系统] 加载远程记忆失败:', e);
            }
        }

        /**
         * 同步记忆到服务器
         */
        async syncMemory(memory) {
            if (!this.userId || !this.supabase) return;

            try {
                const { error } = await this.supabase
                    .from('user_assistant_memory')
                    .upsert({
                        user_id: this.userId,
                        memory_type: memory.type,
                        memory_key: memory.key,
                        memory_value: memory.value,
                        metadata: memory.metadata,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id,memory_type,memory_key'
                    });

                if (error) throw error;

                memory.synced = true;
            } catch (e) {
                console.error('[记忆系统] 同步失败:', e);
            }
        }

        /**
         * 从服务器删除记忆
         */
        async deleteRemoteMemory(memoryKey) {
            if (!this.userId || !this.supabase) return;

            const [type, key] = memoryKey.split(':');

            try {
                const { error } = await this.supabase
                    .from('user_assistant_memory')
                    .delete()
                    .eq('user_id', this.userId)
                    .eq('memory_type', type)
                    .eq('memory_key', key);

                if (error) throw error;
            } catch (e) {
                console.error('[记忆系统] 删除远程记忆失败:', e);
            }
        }

        /**
         * 启动自动同步
         */
        startAutoSync() {
            if (this.syncTimer) clearInterval(this.syncTimer);

            this.syncTimer = setInterval(async () => {
                if (!this.isSyncing && this.userId && this.supabase) {
                    await this.syncAll();
                }
            }, CONFIG.syncInterval);
        }

        /**
         * 同步所有未同步的记忆
         */
        async syncAll() {
            this.isSyncing = true;

            try {
                for (const [key, memory] of Object.entries(this.localCache)) {
                    if (!memory.synced) {
                        await this.syncMemory(memory);
                    }
                }
            } finally {
                this.isSyncing = false;
            }
        }

        /**
         * 清理过期记忆
         */
        async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30天
            const now = Date.now();
            const toDelete = [];

            for (const [key, memory] of Object.entries(this.localCache)) {
                if (now - (memory.updatedAt || memory.createdAt) > maxAge) {
                    toDelete.push(key);
                }
            }

            for (const key of toDelete) {
                await this.forget(...key.split(':'));
            }

            console.log(`[记忆系统] 清理了 ${toDelete.length} 条过期记忆`);
        }

        /**
         * 导出记忆数据
         */
        export() {
            return JSON.stringify(this.localCache, null, 2);
        }

        /**
         * 导入记忆数据
         */
        import(data) {
            try {
                const imported = typeof data === 'string' ? JSON.parse(data) : data;
                this.localCache = { ...this.localCache, ...imported };
                this.saveLocalCache();
                this.syncAll();
            } catch (e) {
                console.error('[记忆系统] 导入失败:', e);
            }
        }

        /**
         * 销毁记忆系统
         */
        destroy() {
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
            }
            this.memories = {};
            this.localCache = {};
            localStorage.removeItem(CONFIG.memoryKey);
        }
    }

    // ==================== 导出 ====================
    window.AssistantMemory = new AssistantMemory();

    // 自动初始化（如果 supabase 已存在）
    if (window.supabase) {
        window.AssistantMemory.init(window.supabase);
    }

    console.log('[记忆系统] 已加载');

})();
