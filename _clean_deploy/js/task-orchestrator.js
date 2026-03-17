/**
 * 🎬 TaskOrchestrator - 智能任务调度器
 * @version 1.0.0
 * @description 统一任务队列管理，支持优先级调度、失败重试、断点续传、预估时间
 * 
 * 核心特性：
 * - 优先级队列：VIP用户优先，紧急任务优先
 * - 智能重试：指数退避，最大重试次数限制
 * - 断点续传：任务状态持久化，刷新后可恢复
 * - 预估时间：基于历史数据动态预估
 * - 并发控制：防止API过载
 */

(function(global) {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 任务配置
        MAX_CONCURRENT: 3,           // 最大并发数
        MAX_RETRIES: 3,              // 最大重试次数
        RETRY_DELAY_BASE: 2000,      // 重试基础延迟(ms)
        RETRY_DELAY_MAX: 30000,      // 最大重试延迟(ms)
        
        // 优先级
        PRIORITY: {
            URGENT: 100,    // 紧急
            HIGH: 75,       // 高
            NORMAL: 50,     // 普通
            LOW: 25,        // 低
            BATCH: 10       // 批量
        },
        
        // 任务状态
        STATUS: {
            PENDING: 'pending',
            RUNNING: 'running',
            COMPLETED: 'completed',
            FAILED: 'failed',
            PAUSED: 'paused',
            CANCELLED: 'cancelled'
        },
        
        // 任务类型对应的预估时间(秒)
        ESTIMATED_TIME: {
            text_story: 8,
            text_character: 5,
            text_scene: 10,
            image_character: 25,
            image_scene: 20,
            video_sora2: 90,
            video_sora2_pro: 180,
            video_merge: 30,
            default: 15
        },
        
        // 持久化键
        STORAGE_KEY: 'task_orchestrator_state'
    };

    // ==================== 任务类 ====================
    class Task {
        constructor(options) {
            this.id = options.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.type = options.type || 'unknown';
            this.priority = options.priority || CONFIG.PRIORITY.NORMAL;
            this.status = CONFIG.STATUS.PENDING;
            this.payload = options.payload || {};
            this.result = null;
            this.error = null;
            this.retryCount = 0;
            this.createdAt = Date.now();
            this.startedAt = null;
            this.completedAt = null;
            this.estimatedTime = options.estimatedTime || CONFIG.ESTIMATED_TIME[options.type] || CONFIG.ESTIMATED_TIME.default;
            this.parentId = options.parentId || null;  // 父任务ID（用于子任务）
            this.children = [];                        // 子任务ID列表
            this.onProgress = options.onProgress || null;
            this.onComplete = options.onComplete || null;
            this.onError = options.onError || null;
        }

        toJSON() {
            return {
                id: this.id,
                type: this.type,
                priority: this.priority,
                status: this.status,
                payload: this.payload,
                result: this.result,
                error: this.error,
                retryCount: this.retryCount,
                createdAt: this.createdAt,
                startedAt: this.startedAt,
                completedAt: this.completedAt,
                estimatedTime: this.estimatedTime,
                parentId: this.parentId,
                children: this.children
            };
        }

        static fromJSON(json) {
            const task = new Task({
                id: json.id,
                type: json.type,
                priority: json.priority,
                payload: json.payload,
                estimatedTime: json.estimatedTime,
                parentId: json.parentId
            });
            task.status = json.status;
            task.result = json.result;
            task.error = json.error;
            task.retryCount = json.retryCount;
            task.createdAt = json.createdAt;
            task.startedAt = json.startedAt;
            task.completedAt = json.completedAt;
            task.children = json.children || [];
            return task;
        }
    }

    // ==================== 调度器核心 ====================
    class TaskOrchestrator {
        constructor() {
            this.tasks = new Map();          // 所有任务
            this.pendingQueue = [];          // 等待队列
            this.runningTasks = new Set();   // 运行中的任务ID
            this.handlers = new Map();       // 任务类型处理器
            this.isPaused = false;           // 全局暂停标志
            this.listeners = new Map();      // 事件监听器
            this.historyData = this._loadHistoryData();  // 历史数据（用于时间预估）
            
            // 从localStorage恢复状态
            this._restoreState();
            
            // 定期保存状态
            setInterval(() => this._saveState(), 5000);
        }

        // ==================== 任务注册 ====================
        /**
         * 注册任务类型处理器
         * @param {string} type - 任务类型
         * @param {Function} handler - 处理函数 async (task) => result
         */
        registerHandler(type, handler) {
            this.handlers.set(type, handler);
            console.log(`📋 [Orchestrator] 注册处理器: ${type}`);
        }

        // ==================== 任务管理 ====================
        /**
         * 添加任务
         * @param {Object} options - 任务配置
         * @returns {Task} 创建的任务
         */
        addTask(options) {
            const task = new Task(options);
            this.tasks.set(task.id, task);
            this.pendingQueue.push(task.id);
            this._sortQueue();
            
            this._emit('taskAdded', task);
            console.log(`➕ [Orchestrator] 添加任务: ${task.id} (${task.type}), 优先级: ${task.priority}`);
            
            // 尝试执行
            this._tryExecuteNext();
            
            return task;
        }

        /**
         * 批量添加任务
         * @param {Array} taskOptions - 任务配置数组
         * @returns {Array<Task>} 创建的任务列表
         */
        addTasks(taskOptions) {
            const tasks = taskOptions.map(opt => {
                const task = new Task(opt);
                this.tasks.set(task.id, task);
                this.pendingQueue.push(task.id);
                return task;
            });
            this._sortQueue();
            
            this._emit('tasksAdded', tasks);
            console.log(`➕ [Orchestrator] 批量添加 ${tasks.length} 个任务`);
            
            this._tryExecuteNext();
            
            return tasks;
        }

        /**
         * 创建工作流（有依赖关系的任务组）
         * @param {Object} workflow - 工作流配置
         * @returns {string} 工作流ID
         */
        createWorkflow(workflow) {
            const workflowId = `workflow_${Date.now()}`;
            const { steps, onComplete, onProgress } = workflow;
            
            // 创建父任务
            const parentTask = this.addTask({
                id: workflowId,
                type: 'workflow',
                priority: workflow.priority || CONFIG.PRIORITY.NORMAL,
                payload: { name: workflow.name, totalSteps: steps.length },
                onComplete,
                onProgress
            });
            
            // 按顺序创建子任务（第一个立即执行，后续等待前一个完成）
            let prevTaskId = null;
            steps.forEach((step, index) => {
                const childTask = new Task({
                    ...step,
                    id: `${workflowId}_step_${index}`,
                    parentId: workflowId,
                    payload: { ...step.payload, stepIndex: index, totalSteps: steps.length }
                });
                
                // 只有第一个任务立即加入队列
                if (index === 0) {
                    this.tasks.set(childTask.id, childTask);
                    this.pendingQueue.push(childTask.id);
                } else {
                    // 后续任务暂存，等待前一个完成后再加入
                    childTask.status = CONFIG.STATUS.PAUSED;
                    childTask.prevTaskId = prevTaskId;
                    this.tasks.set(childTask.id, childTask);
                }
                
                parentTask.children.push(childTask.id);
                prevTaskId = childTask.id;
            });
            
            this._sortQueue();
            this._tryExecuteNext();
            
            return workflowId;
        }

        /**
         * 取消任务
         * @param {string} taskId - 任务ID
         */
        cancelTask(taskId) {
            const task = this.tasks.get(taskId);
            if (!task) return;
            
            if (task.status === CONFIG.STATUS.PENDING) {
                const idx = this.pendingQueue.indexOf(taskId);
                if (idx !== -1) this.pendingQueue.splice(idx, 1);
            }
            
            task.status = CONFIG.STATUS.CANCELLED;
            this._emit('taskCancelled', task);
            console.log(`🚫 [Orchestrator] 取消任务: ${taskId}`);
        }

        /**
         * 重试失败任务
         * @param {string} taskId - 任务ID
         */
        retryTask(taskId) {
            const task = this.tasks.get(taskId);
            if (!task || task.status !== CONFIG.STATUS.FAILED) return;
            
            task.status = CONFIG.STATUS.PENDING;
            task.error = null;
            task.retryCount++;
            this.pendingQueue.push(taskId);
            this._sortQueue();
            
            this._emit('taskRetry', task);
            console.log(`🔄 [Orchestrator] 重试任务: ${taskId} (第${task.retryCount}次)`);
            
            this._tryExecuteNext();
        }

        /**
         * 暂停所有任务
         */
        pause() {
            this.isPaused = true;
            this._emit('paused');
            console.log('⏸️ [Orchestrator] 已暂停');
        }

        /**
         * 恢复执行
         */
        resume() {
            this.isPaused = false;
            this._emit('resumed');
            console.log('▶️ [Orchestrator] 已恢复');
            this._tryExecuteNext();
        }

        // ==================== 查询接口 ====================
        /**
         * 获取任务
         * @param {string} taskId - 任务ID
         * @returns {Task|null}
         */
        getTask(taskId) {
            return this.tasks.get(taskId) || null;
        }

        /**
         * 获取队列状态
         * @returns {Object}
         */
        getStatus() {
            const pending = this.pendingQueue.length;
            const running = this.runningTasks.size;
            const completed = [...this.tasks.values()].filter(t => t.status === CONFIG.STATUS.COMPLETED).length;
            const failed = [...this.tasks.values()].filter(t => t.status === CONFIG.STATUS.FAILED).length;
            
            // 计算预估剩余时间
            const pendingTasks = this.pendingQueue.map(id => this.tasks.get(id)).filter(Boolean);
            const runningTasksList = [...this.runningTasks].map(id => this.tasks.get(id)).filter(Boolean);
            
            let estimatedTimeRemaining = 0;
            pendingTasks.forEach(t => estimatedTimeRemaining += t.estimatedTime);
            runningTasksList.forEach(t => {
                const elapsed = (Date.now() - t.startedAt) / 1000;
                estimatedTimeRemaining += Math.max(0, t.estimatedTime - elapsed);
            });
            
            // 考虑并发
            estimatedTimeRemaining = Math.ceil(estimatedTimeRemaining / Math.min(CONFIG.MAX_CONCURRENT, pending + running || 1));
            
            return {
                pending,
                running,
                completed,
                failed,
                total: this.tasks.size,
                isPaused: this.isPaused,
                estimatedTimeRemaining,  // 秒
                estimatedTimeFormatted: this._formatTime(estimatedTimeRemaining)
            };
        }

        /**
         * 获取任务进度百分比
         * @param {string} taskId - 任务ID（可选，不传则返回全局进度）
         * @returns {number} 0-100
         */
        getProgress(taskId = null) {
            if (taskId) {
                const task = this.tasks.get(taskId);
                if (!task) return 0;
                if (task.status === CONFIG.STATUS.COMPLETED) return 100;
                if (task.status === CONFIG.STATUS.PENDING) return 0;
                if (task.status === CONFIG.STATUS.RUNNING && task.startedAt) {
                    const elapsed = (Date.now() - task.startedAt) / 1000;
                    return Math.min(95, Math.round((elapsed / task.estimatedTime) * 100));
                }
                return 0;
            }
            
            // 全局进度
            const status = this.getStatus();
            if (status.total === 0) return 100;
            return Math.round(((status.completed + status.failed) / status.total) * 100);
        }

        // ==================== 事件系统 ====================
        /**
         * 监听事件
         * @param {string} event - 事件名
         * @param {Function} callback - 回调函数
         */
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(callback);
        }

        /**
         * 移除监听
         * @param {string} event - 事件名
         * @param {Function} callback - 回调函数
         */
        off(event, callback) {
            const listeners = this.listeners.get(event);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) listeners.splice(idx, 1);
            }
        }

        _emit(event, data) {
            const listeners = this.listeners.get(event);
            if (listeners) {
                listeners.forEach(cb => {
                    try { cb(data); } catch (e) { console.error(`[Orchestrator] 事件回调错误:`, e); }
                });
            }
        }

        // ==================== 内部方法 ====================
        _sortQueue() {
            // 按优先级降序排列
            this.pendingQueue.sort((a, b) => {
                const taskA = this.tasks.get(a);
                const taskB = this.tasks.get(b);
                if (!taskA || !taskB) return 0;
                return taskB.priority - taskA.priority;
            });
        }

        async _tryExecuteNext() {
            if (this.isPaused) return;
            if (this.runningTasks.size >= CONFIG.MAX_CONCURRENT) return;
            if (this.pendingQueue.length === 0) return;
            
            const taskId = this.pendingQueue.shift();
            const task = this.tasks.get(taskId);
            if (!task) return this._tryExecuteNext();
            
            // 检查处理器是否存在
            const handler = this.handlers.get(task.type);
            if (!handler) {
                console.warn(`⚠️ [Orchestrator] 未找到处理器: ${task.type}`);
                task.status = CONFIG.STATUS.FAILED;
                task.error = `未找到处理器: ${task.type}`;
                this._emit('taskFailed', task);
                return this._tryExecuteNext();
            }
            
            // 开始执行
            task.status = CONFIG.STATUS.RUNNING;
            task.startedAt = Date.now();
            this.runningTasks.add(taskId);
            
            this._emit('taskStarted', task);
            console.log(`🚀 [Orchestrator] 开始执行: ${taskId} (${task.type})`);
            
            try {
                const result = await handler(task);
                
                task.status = CONFIG.STATUS.COMPLETED;
                task.result = result;
                task.completedAt = Date.now();
                
                // 记录实际执行时间（用于优化预估）
                const actualTime = (task.completedAt - task.startedAt) / 1000;
                this._recordActualTime(task.type, actualTime);
                
                this._emit('taskCompleted', task);
                if (task.onComplete) task.onComplete(result);
                
                console.log(`✅ [Orchestrator] 完成: ${taskId}, 耗时: ${actualTime.toFixed(1)}s`);
                
                // 如果是工作流子任务，触发下一个
                this._triggerNextWorkflowStep(task);
                
            } catch (error) {
                const errorMsg = error?.message || String(error);
                console.error(`❌ [Orchestrator] 失败: ${taskId}`, errorMsg);
                
                // 判断是否应该重试
                if (this._shouldRetry(task, error)) {
                    const delay = this._getRetryDelay(task.retryCount);
                    console.log(`🔄 [Orchestrator] ${delay}ms 后重试 (${task.retryCount + 1}/${CONFIG.MAX_RETRIES})`);
                    
                    setTimeout(() => {
                        task.retryCount++;
                        task.status = CONFIG.STATUS.PENDING;
                        this.pendingQueue.unshift(taskId);  // 重试任务优先
                        this._tryExecuteNext();
                    }, delay);
                } else {
                    task.status = CONFIG.STATUS.FAILED;
                    task.error = errorMsg;
                    task.completedAt = Date.now();
                    
                    this._emit('taskFailed', task);
                    if (task.onError) task.onError(error);
                }
            } finally {
                this.runningTasks.delete(taskId);
                this._tryExecuteNext();
            }
        }

        _shouldRetry(task, error) {
            if (task.retryCount >= CONFIG.MAX_RETRIES) return false;
            
            const msg = String(error?.message || error || '').toLowerCase();
            
            // 不重试的错误类型
            const noRetryErrors = [
                '余额不足', 'insufficient', 'quota', '配额',
                '内容审核', 'content policy', 'moderation',
                '未登录', 'unauthorized', '401',
                '参数错误', 'invalid parameter', '400'
            ];
            
            for (const keyword of noRetryErrors) {
                if (msg.includes(keyword)) return false;
            }
            
            // 可重试的错误类型
            const retryableErrors = [
                'timeout', '超时', '500', '502', '503', '504',
                'network', '网络', 'connection', 'ECONNRESET',
                '节点不可用', 'unavailable', 'retry', '429'
            ];
            
            for (const keyword of retryableErrors) {
                if (msg.includes(keyword)) return true;
            }
            
            // 默认重试
            return true;
        }

        _getRetryDelay(retryCount) {
            // 指数退避
            const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, retryCount);
            return Math.min(delay, CONFIG.RETRY_DELAY_MAX);
        }

        _triggerNextWorkflowStep(completedTask) {
            if (!completedTask.parentId) return;
            
            const parentTask = this.tasks.get(completedTask.parentId);
            if (!parentTask) return;
            
            // 找到下一个暂停的子任务
            for (const childId of parentTask.children) {
                const child = this.tasks.get(childId);
                if (child && child.status === CONFIG.STATUS.PAUSED && child.prevTaskId === completedTask.id) {
                    child.status = CONFIG.STATUS.PENDING;
                    this.pendingQueue.push(childId);
                    this._sortQueue();
                    console.log(`➡️ [Orchestrator] 触发下一步: ${childId}`);
                    this._tryExecuteNext();
                    break;
                }
            }
            
            // 检查工作流是否全部完成
            const allCompleted = parentTask.children.every(id => {
                const t = this.tasks.get(id);
                return t && (t.status === CONFIG.STATUS.COMPLETED || t.status === CONFIG.STATUS.FAILED);
            });
            
            if (allCompleted) {
                parentTask.status = CONFIG.STATUS.COMPLETED;
                parentTask.completedAt = Date.now();
                this._emit('workflowCompleted', parentTask);
                if (parentTask.onComplete) {
                    const results = parentTask.children.map(id => this.tasks.get(id)?.result);
                    parentTask.onComplete(results);
                }
            }
        }

        // ==================== 持久化 ====================
        _saveState() {
            try {
                const state = {
                    tasks: [...this.tasks.entries()].map(([id, task]) => [id, task.toJSON()]),
                    pendingQueue: this.pendingQueue,
                    timestamp: Date.now()
                };
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.warn('[Orchestrator] 保存状态失败:', e);
            }
        }

        _restoreState() {
            try {
                const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (!saved) return;
                
                const state = JSON.parse(saved);
                
                // 只恢复30分钟内的状态
                if (Date.now() - state.timestamp > 30 * 60 * 1000) {
                    localStorage.removeItem(CONFIG.STORAGE_KEY);
                    return;
                }
                
                // 恢复任务
                state.tasks.forEach(([id, json]) => {
                    const task = Task.fromJSON(json);
                    // 运行中的任务重置为等待
                    if (task.status === CONFIG.STATUS.RUNNING) {
                        task.status = CONFIG.STATUS.PENDING;
                    }
                    this.tasks.set(id, task);
                });
                
                // 恢复等待队列
                this.pendingQueue = state.pendingQueue.filter(id => {
                    const task = this.tasks.get(id);
                    return task && task.status === CONFIG.STATUS.PENDING;
                });
                
                console.log(`📂 [Orchestrator] 恢复 ${this.tasks.size} 个任务, ${this.pendingQueue.length} 个等待中`);
                
            } catch (e) {
                console.warn('[Orchestrator] 恢复状态失败:', e);
            }
        }

        // ==================== 时间预估 ====================
        _loadHistoryData() {
            try {
                return JSON.parse(localStorage.getItem('task_time_history') || '{}');
            } catch (e) {
                return {};
            }
        }

        _recordActualTime(type, seconds) {
            if (!this.historyData[type]) {
                this.historyData[type] = [];
            }
            this.historyData[type].push(seconds);
            // 只保留最近20条
            if (this.historyData[type].length > 20) {
                this.historyData[type].shift();
            }
            
            // 更新预估值
            const avg = this.historyData[type].reduce((a, b) => a + b, 0) / this.historyData[type].length;
            CONFIG.ESTIMATED_TIME[type] = Math.round(avg);
            
            try {
                localStorage.setItem('task_time_history', JSON.stringify(this.historyData));
            } catch (e) {}
        }

        _formatTime(seconds) {
            if (seconds < 60) return `${seconds}秒`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            return `${h}小时${m}分`;
        }

        // ==================== 清理 ====================
        /**
         * 清理已完成/失败的任务
         * @param {number} olderThanMs - 清理多久之前的任务（默认1小时）
         */
        cleanup(olderThanMs = 60 * 60 * 1000) {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [id, task] of this.tasks) {
                if (task.status === CONFIG.STATUS.COMPLETED || task.status === CONFIG.STATUS.FAILED || task.status === CONFIG.STATUS.CANCELLED) {
                    if (task.completedAt && (now - task.completedAt > olderThanMs)) {
                        this.tasks.delete(id);
                        cleaned++;
                    }
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 [Orchestrator] 清理了 ${cleaned} 个旧任务`);
            }
        }
    }

    // ==================== 导出 ====================
    const orchestrator = new TaskOrchestrator();
    
    // 暴露到全局
    global.TaskOrchestrator = orchestrator;
    global.TaskOrchestratorClass = TaskOrchestrator;
    global.TaskClass = Task;
    global.TASK_CONFIG = CONFIG;

    console.log('🎬 [TaskOrchestrator] 智能任务调度器已加载');

})(typeof window !== 'undefined' ? window : global);
