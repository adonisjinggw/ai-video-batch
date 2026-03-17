/**
 * 📦 页面状态管理模块 - 统一管理所有页面的状态保存和恢复
 * 功能：
 * 1. 自动保存页面输入状态（切换页面不丢失）
 * 2. 任务后台执行（切换页面任务继续运行）
 * 3. 返回时恢复状态和结果
 */

const PageState = {
    // 存储前缀，避免冲突
    PREFIX: 'rollroll_state_',
    
    /**
     * 保存页面状态
     * @param {string} pageId - 页面标识（如 'mobile', 'sticker', 'video-tools'）
     * @param {object} state - 状态对象
     */
    save(pageId, state) {
        try {
            const key = this.PREFIX + pageId;
            const data = {
                ...state,
                _timestamp: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(data));
            console.log(`[PageState] 💾 已保存 ${pageId} 状态`);
        } catch (e) {
            console.warn('[PageState] 保存状态失败:', e);
        }
    },
    
    /**
     * 恢复页面状态
     * @param {string} pageId - 页面标识
     * @returns {object|null} 状态对象，或 null（无保存状态）
     */
    load(pageId) {
        try {
            const key = this.PREFIX + pageId;
            const saved = sessionStorage.getItem(key);
            if (!saved) return null;
            const state = JSON.parse(saved);
            console.log(`[PageState] 📂 已恢复 ${pageId} 状态`);
            return state;
        } catch (e) {
            console.warn('[PageState] 恢复状态失败:', e);
            return null;
        }
    },
    
    /**
     * 清除页面状态
     * @param {string} pageId - 页面标识
     */
    clear(pageId) {
        try {
            const key = this.PREFIX + pageId;
            sessionStorage.removeItem(key);
            console.log(`[PageState] 🗑️ 已清除 ${pageId} 状态`);
        } catch (e) {
            console.warn('[PageState] 清除状态失败:', e);
        }
    },
    
    /**
     * 自动绑定页面事件（页面切换时自动保存）
     * @param {string} pageId - 页面标识
     * @param {function} getStateFn - 获取当前状态的函数
     * @param {function} restoreStateFn - 恢复状态的函数
     */
    autoBind(pageId, getStateFn, restoreStateFn) {
        // 页面隐藏时保存状态
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                const state = getStateFn();
                if (state) this.save(pageId, state);
            }
        });
        
        // 页面卸载前保存
        window.addEventListener('beforeunload', () => {
            const state = getStateFn();
            if (state) this.save(pageId, state);
        });
        
        // 页面加载时恢复
        window.addEventListener('load', () => {
            setTimeout(() => {
                const state = this.load(pageId);
                if (state && restoreStateFn) {
                    restoreStateFn(state);
                }
            }, 100);
        });
        
        console.log(`[PageState] 🔗 已绑定 ${pageId} 自动保存/恢复`);
    }
};

/**
 * 📋 后台任务管理器 - 管理正在执行的任务
 * 支持：任务在后台继续运行，返回时查看结果
 */
const TaskManager = {
    PREFIX: 'rollroll_tasks_',
    
    /**
     * 添加一个任务
     * @param {string} pageId - 页面标识
     * @param {string} taskId - 任务ID
     * @param {object} taskInfo - 任务信息
     */
    addTask(pageId, taskId, taskInfo) {
        try {
            const key = this.PREFIX + pageId;
            const tasks = this.getTasks(pageId);
            tasks[taskId] = {
                ...taskInfo,
                status: 'running',
                startTime: Date.now()
            };
            sessionStorage.setItem(key, JSON.stringify(tasks));
            console.log(`[TaskManager] ➕ 添加任务: ${pageId}/${taskId}`);
        } catch (e) {
            console.warn('[TaskManager] 添加任务失败:', e);
        }
    },
    
    /**
     * 更新任务状态
     * @param {string} pageId - 页面标识
     * @param {string} taskId - 任务ID
     * @param {object} update - 更新内容
     */
    updateTask(pageId, taskId, update) {
        try {
            const key = this.PREFIX + pageId;
            const tasks = this.getTasks(pageId);
            if (tasks[taskId]) {
                tasks[taskId] = { ...tasks[taskId], ...update };
                sessionStorage.setItem(key, JSON.stringify(tasks));
            }
        } catch (e) {
            console.warn('[TaskManager] 更新任务失败:', e);
        }
    },
    
    /**
     * 完成任务
     * @param {string} pageId - 页面标识
     * @param {string} taskId - 任务ID
     * @param {object} result - 任务结果
     */
    completeTask(pageId, taskId, result) {
        this.updateTask(pageId, taskId, {
            status: 'completed',
            result,
            endTime: Date.now()
        });
        console.log(`[TaskManager] ✅ 任务完成: ${pageId}/${taskId}`);
    },
    
    /**
     * 任务失败
     * @param {string} pageId - 页面标识
     * @param {string} taskId - 任务ID
     * @param {string} error - 错误信息
     */
    failTask(pageId, taskId, error) {
        this.updateTask(pageId, taskId, {
            status: 'failed',
            error,
            endTime: Date.now()
        });
        console.log(`[TaskManager] ❌ 任务失败: ${pageId}/${taskId}`);
    },
    
    /**
     * 获取所有任务
     * @param {string} pageId - 页面标识
     * @returns {object} 任务列表
     */
    getTasks(pageId) {
        try {
            const key = this.PREFIX + pageId;
            const saved = sessionStorage.getItem(key);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },
    
    /**
     * 获取运行中的任务
     * @param {string} pageId - 页面标识
     * @returns {array} 运行中的任务列表
     */
    getRunningTasks(pageId) {
        const tasks = this.getTasks(pageId);
        return Object.entries(tasks)
            .filter(([_, t]) => t.status === 'running')
            .map(([id, t]) => ({ id, ...t }));
    },
    
    /**
     * 获取已完成的任务
     * @param {string} pageId - 页面标识
     * @returns {array} 已完成的任务列表
     */
    getCompletedTasks(pageId) {
        const tasks = this.getTasks(pageId);
        return Object.entries(tasks)
            .filter(([_, t]) => t.status === 'completed')
            .map(([id, t]) => ({ id, ...t }));
    },
    
    /**
     * 清除已完成的任务
     * @param {string} pageId - 页面标识
     */
    clearCompletedTasks(pageId) {
        try {
            const key = this.PREFIX + pageId;
            const tasks = this.getTasks(pageId);
            const running = {};
            Object.entries(tasks).forEach(([id, t]) => {
                if (t.status === 'running') running[id] = t;
            });
            sessionStorage.setItem(key, JSON.stringify(running));
        } catch (e) {
            console.warn('[TaskManager] 清除任务失败:', e);
        }
    },
    
    /**
     * 清除所有任务
     * @param {string} pageId - 页面标识
     */
    clearAllTasks(pageId) {
        try {
            const key = this.PREFIX + pageId;
            sessionStorage.removeItem(key);
        } catch (e) {
            console.warn('[TaskManager] 清除任务失败:', e);
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.PageState = PageState;
    window.TaskManager = TaskManager;
}
