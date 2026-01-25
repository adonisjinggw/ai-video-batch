/**
 * Supabase 配置文件
 * RollRoll AI 会员系统
 * @version 1.0.1
 */

// 🌐 域名强制跳转：已停用（按需求 C：任何域名都不自动跳转）
// 注意：如果未来只想做 www → non-www，请在这里单独加白名单规则，避免影响 rollroll.art。

// Supabase 项目配置
const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkb3F1eHZzbHN1aHdnaXF3YnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNjY5MTcsImV4cCI6MjA3OTY0MjkxN30.O3AGRwex-mnn0GmGfbuqUO-znH-s0uKyRzO_bVo_6Rc';

// 初始化 Supabase 客户端
let supabaseClient = null;

let __nvAuthReadyPromise = null;
let __nvAuthReadyResolve = null;
let __nvCachedSession = null;
let __nvCachedUser = null;
let __nvAuthListenerBound = false;

/**
 * 获取 Supabase 客户端实例
 * @returns {Object} Supabase client
 */
function getSupabase() {
    if (!supabaseClient) {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: 'rollroll-auth'
                }
            });
            console.log('✅ Supabase 客户端初始化成功');

            try {
                if (!__nvAuthReadyPromise) {
                    __nvAuthReadyPromise = new Promise((resolve) => {
                        __nvAuthReadyResolve = resolve;
                    });
                }
                if (!__nvAuthListenerBound) {
                    __nvAuthListenerBound = true;
                    supabaseClient.auth.onAuthStateChange((event, session) => {
                        __nvCachedSession = session || null;
                        __nvCachedUser = session?.user || null;
                        try {
                            if (event === 'SIGNED_OUT') {
                                localStorage.removeItem('nv_user_profile');
                                localStorage.removeItem('membership_type');
                                localStorage.removeItem('vip_info');
                                localStorage.removeItem('vip_expiry');
                            }
                        } catch (e) { }
                        try { __nvAuthReadyResolve && __nvAuthReadyResolve(true); } catch (e) { }
                        console.log('🔐 认证状态变化:', event);
                    });
                }

                supabaseClient.auth.getSession().then(({ data }) => {
                    __nvCachedSession = data?.session || null;
                    __nvCachedUser = data?.session?.user || null;
                    try { __nvAuthReadyResolve && __nvAuthReadyResolve(true); } catch (e) { }
                }).catch(() => {
                    try { __nvAuthReadyResolve && __nvAuthReadyResolve(true); } catch (e) { }
                });
            } catch (e) { }
        } else {
            const warningMsg = '❌ Supabase SDK 未加载（/api/supabase-sdk 代理可能被插件阻断）。请刷新页面或关闭脚本拦截类插件后重试。';
            console.error(warningMsg);
            if (typeof window !== 'undefined') {
                window.__supabaseSdkLoadError = warningMsg;
            }
            return null;
        }
    }
    return supabaseClient;
}

// ==================== 用户认证 ====================

/**
 * 邮箱注册
 * @param {string} email - 邮箱地址
 * @param {string} password - 密码
 * @param {string} nickname - 昵称（可选）
 * @param {string} inviteCode - 邀请码（可选）
 * @returns {Promise<Object>} 注册结果
 */
async function signUpWithEmail(email, password, nickname = '', inviteCode = '') {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    // 🔧 移除 emailRedirectTo，避免触发邮箱验证流程
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                nickname: nickname || email.split('@')[0],
                invite_code_used: inviteCode
            }
        }
    });

    if (error) throw error;

    // 如果有邀请码，处理邀请奖励
    if (inviteCode && data.user) {
        try {
            await processInviteBonus(data.user.id, inviteCode);
        } catch (e) {
            console.warn('邀请码处理失败:', e.message);
        }
    }

    return data;
}

/**
 * 邮箱登录
 * @param {string} email - 邮箱地址
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果
 */
async function signInWithEmail(email, password) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) throw error;

    // 更新最后登录时间
    if (data.user) {
        await updateLastLogin(data.user.id);
    }

    return data;
}

/**
 * 退出登录
 * @returns {Promise<void>}
 */
async function signOut() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const { error } = await client.auth.signOut();
    if (error) throw error;

    // 清除本地缓存的用户数据
    localStorage.removeItem('nv_user_profile');
    console.log('✅ 已退出登录');
}

/**
 * 获取当前用户
 * @returns {Promise<Object|null>} 当前用户信息
 */
async function getCurrentUser() {
    const client = getSupabase();
    if (!client) return null;

    try {
        const timeoutMs = 1200;
        await Promise.race([
            (__nvAuthReadyPromise || Promise.resolve(true)),
            new Promise(resolve => setTimeout(resolve, timeoutMs))
        ]);
    } catch (e) { }

    if (__nvCachedUser) return __nvCachedUser;

    try {
        const { data } = await client.auth.getSession();
        __nvCachedSession = data?.session || null;
        __nvCachedUser = data?.session?.user || null;
        if (__nvCachedUser) return __nvCachedUser;
    } catch (e) { }

    try {
        const { data: { user } } = await client.auth.getUser();
        __nvCachedUser = user || null;
        return user || null;
    } catch (e) {
        return null;
    }
}

/**
 * 监听认证状态变化
 * @param {Function} callback - 回调函数
 */
function onAuthStateChange(callback) {
    const client = getSupabase();
    if (!client) return;

    client.auth.onAuthStateChange((event, session) => {
        __nvCachedSession = session || null;
        __nvCachedUser = session?.user || null;
        console.log('🔐 认证状态变化:', event);
        callback(event, session);
    });
}

/**
 * 发送密码重置邮件
 * @param {string} email - 邮箱地址
 * @returns {Promise<Object>}
 */
async function resetPassword(email) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    // ✅ 回调地址跟随当前访问域名（支持 www.rollroll.art / rollroll.art / 预览域名）
    // 注意：Supabase 控制台里需要把这些 URL 加到 Auth → URL Configuration → Redirect URLs 白名单里
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.rollroll.art';
    const redirectTo = `${origin}/reset-password.html`;

    const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo
    });

    if (error) throw error;
    return data;
}

// ==================== 用户配置 ====================

/**
 * 获取用户配置
 * @param {string} userId - 用户ID（可选，默认当前用户）
 * @returns {Promise<Object>} 用户配置
 */
async function getUserProfile(userId = null) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    if (!userId) {
        const user = await getCurrentUser();
        if (!user) throw new Error('用户未登录');
        userId = user.id;
    }

    const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;

    // 缓存到本地
    localStorage.setItem('nv_user_profile', JSON.stringify(data));

    // 🔧 同步会员状态到localStorage（供isVip()检查）- 即使为free也要设置
    const memberType = data.membership_type || 'free';
    localStorage.setItem('membership_type', memberType);
    console.log('👑 同步会员状态:', memberType);

    // 🔧 同步会员过期时间
    if (data.membership_expires) {
        localStorage.setItem('vip_expiry', data.membership_expires);
        // 同时更新vip_info以兼容旧逻辑
        const vipInfo = { type: memberType, expiry: data.membership_expires };
        localStorage.setItem('vip_info', JSON.stringify(vipInfo));
    } else if (memberType !== 'free') {
        // 有会员但没过期时间，设置一个较长的默认值
        const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem('vip_expiry', defaultExpiry);
        const vipInfo = { type: memberType, expiry: defaultExpiry };
        localStorage.setItem('vip_info', JSON.stringify(vipInfo));
    }

    // 🔧 同步胶片余额（直接使用数据库值，不包含lots）
    if (data.quota_balance !== undefined) {
        localStorage.setItem('film_balance', String(data.quota_balance));
        localStorage.setItem('cloud_film_balance', String(data.quota_balance));
        console.log('🎞️ 胶片余额同步:', data.quota_balance);
    }

    try {
        if (data.membership_level !== undefined && data.membership_level !== null) {
            const lv = Number(data.membership_level);
            if (Number.isFinite(lv)) {
                localStorage.setItem('membership_level', String(lv));
                window.currentMembershipLevel = lv;
            }
        }
    } catch (e) { }

    return data;
}

/**
 * 更新用户配置
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<Object>} 更新后的配置
 */
async function updateUserProfile(updates) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

    if (error) throw error;

    // 更新本地缓存
    localStorage.setItem('nv_user_profile', JSON.stringify(data));

    return data;
}

/**
 * 更新最后登录时间
 * @param {string} userId - 用户ID
 */
async function updateLastLogin(userId) {
    const client = getSupabase();
    if (!client) return;

    await client
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
}

// ==================== 任务管理 ====================

/**
 * 同步任务到云端
 * @param {Array} tasks - 任务列表
 * @returns {Promise<void>}
 */
async function syncTasksToCloud(tasks, deletedTaskIds = []) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 🔧 【重要】先删除，再同步！避免竞态条件导致删除的任务被 upsert 覆盖
    if (deletedTaskIds.length > 0) {
        console.log(`🗑️ 先删除 ${deletedTaskIds.length} 个任务...`);
        for (const taskId of deletedTaskIds) {
            try {
                await deleteTaskFromCloud(taskId);
                console.log(`🗑️ 云端已删除任务: ${taskId}`);
            } catch (e) {
                console.warn(`⚠️ 删除任务失败: ${taskId}`, e);
            }
        }
    }

    // 🔧 过滤掉已删除的任务和无效任务（id为undefined的）
    const activeTasks = tasks.filter(task => {
        // 必须有有效的id
        if (!task || task.id === undefined || task.id === null) {
            console.warn('⚠️ 跳过无效任务（无ID）:', task?.theme?.substring(0, 20));
            return false;
        }
        // 不能是已删除的
        if (deletedTaskIds.includes(task.id)) {
            return false;
        }
        return true;
    });

    if (activeTasks.length > 0) {
        // 批量upsert活跃任务
        const MAX_THEME_LEN = 480; // Supabase: theme 字段 varchar(500)，留余量避免编码差异/emoji
        const safeTheme = (t) => {
            const s = String(t ?? '').trim() || '未命名任务';
            return s.length > MAX_THEME_LEN ? (s.slice(0, MAX_THEME_LEN) + '…') : s;
        };
        const tasksToSync = activeTasks.map(task => ({
            user_id: user.id,
            task_id: task.id,
            theme: safeTheme(task.theme || task.title || '未命名任务'),
            status: task.status || 'pending',
            task_data: task,
            is_deleted: false
        }));

        console.log(`📤 准备同步 ${tasksToSync.length} 个任务到云端`);

        const { error } = await client
            .from('user_tasks')
            .upsert(tasksToSync, {
                onConflict: 'user_id,task_id',
                ignoreDuplicates: false
            });

        if (error) throw error;
        console.log(`✅ 已同步 ${activeTasks.length} 个任务到云端`);
    }
}

/**
 * 从云端获取任务
 * @returns {Promise<Array>} 任务列表
 */
async function getTasksFromCloud() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 🔧 使用 or 条件处理 is_deleted 可能为 null 或 false 的情况
    const { data, error } = await client
        .from('user_tasks')
        .select('*')
        .eq('user_id', user.id)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('updated_at', { ascending: false });

    if (error) throw error;

    console.log(`☁️ 从云端获取了 ${data?.length || 0} 个任务`);

    // 提取task_data，同时返回task_id用于过滤
    // 🔧 确保每个任务都有有效的ID
    return data.map(row => {
        const taskData = row.task_data || {};
        // 优先使用 task_id，其次使用 task_data 中的 id
        const id = row.task_id || taskData.id;

        if (!id) {
            console.warn('⚠️ 云端任务缺少ID，跳过:', row.theme);
            return null;
        }

        return {
            ...taskData,
            id: id,
            theme: row.theme || taskData.theme || '未命名任务'
        };
    }).filter(task => task !== null); // 过滤掉无效任务
}

/**
 * 删除云端任务
 * @param {number} taskId - 任务ID
 * @returns {Promise<void>}
 */
async function deleteTaskFromCloud(taskId) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 🔧 修复：确保task_id使用正确的类型（数据库中可能是bigint或text）
    const taskIdStr = String(taskId);
    const taskIdNum = Number(taskId);

    console.log(`🗑️ 正在从云端删除任务: ${taskId} (str: ${taskIdStr}, num: ${taskIdNum})`);

    // 🔧 尝试两种方式删除：先用数字，再用字符串
    let deleted = false;

    // 方式1: 用数字ID删除
    if (!isNaN(taskIdNum)) {
        const { error: err1, count: cnt1 } = await client
            .from('user_tasks')
            .delete()
            .eq('user_id', user.id)
            .eq('task_id', taskIdNum);

        if (!err1) {
            deleted = true;
            console.log(`✅ 云端已删除任务(数字ID): ${taskIdNum}`);
        }
    }

    // 方式2: 用字符串ID删除（兜底）
    if (!deleted) {
        const { error: err2 } = await client
            .from('user_tasks')
            .delete()
            .eq('user_id', user.id)
            .eq('task_id', taskIdStr);

        if (err2) {
            console.error('❌ 云端删除失败:', err2);
            throw err2;
        }
        console.log(`✅ 云端已删除任务(字符串ID): ${taskIdStr}`);
    }
}

// ==================== 角色库管理 ====================

/**
 * 同步角色到云端
 * @param {Array} characters - 角色列表
 * @returns {Promise<void>}
 */
async function syncCharactersToCloud(characters) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 先删除用户所有角色，再重新插入
    await client
        .from('user_characters')
        .delete()
        .eq('user_id', user.id);

    if (characters.length === 0) return;

    const charsToSync = characters.map(char => ({
        user_id: user.id,
        name: char.name,
        summary: char.summary,
        image_url: char.imageUrl,
        video_url: char.videoUrl,
        tags: char.tags || [],
        is_public: char.isPublic || false
    }));

    const { error } = await client
        .from('user_characters')
        .insert(charsToSync);

    if (error) throw error;
    console.log(`✅ 已同步 ${characters.length} 个角色到云端`);
}

/**
 * 从云端获取角色
 * @returns {Promise<Array>} 角色列表
 */
async function getCharactersFromCloud() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('user_characters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    // 转换为前端格式
    return data.map(row => ({
        name: row.name,
        summary: row.summary,
        imageUrl: row.image_url,
        videoUrl: row.video_url,
        tags: row.tags,
        isPublic: row.is_public
    }));
}

// ==================== 设置管理 ====================

/**
 * 同步设置到云端
 * @param {Object} settings - 设置对象
 * @returns {Promise<void>}
 */
async function syncSettingsToCloud(settings) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { error } = await client
        .from('user_settings')
        .upsert({
            user_id: user.id,
            // 不落地敏感Key
            settings_data: {
                ...settings,
                zhenzhenKey: null,
                rhKey: null
            }
        }, { onConflict: 'user_id' });

    if (error) throw error;
    console.log('✅ 设置已同步到云端');
}

/**
 * 从云端获取设置
 * @returns {Promise<Object>} 设置对象
 */
async function getSettingsFromCloud() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 无记录

    if (!data) return {};

    // 解密敏感信息
    const settings = data.settings_data || {};
    // 不返回敏感Key
    return {
        ...settings,
        zhenzhenKey: '',
        rhKey: ''
    };
}

// ==================== 额度管理 ====================

/**
 * 增加额度（充值）
 * @param {number} amount - 增加数量
 * @param {string} description - 描述
 * @returns {Promise<Object>} 更新后的配置
 */
async function addQuotaCloud(amount, description = '充值') {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化，请刷新页面');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 获取当前余额
    const profile = await getUserProfile();
    const newBalance = profile.quota_balance + amount;

    // 更新余额
    const { error: updateError } = await client
        .from('user_profiles')
        .update({ quota_balance: newBalance })
        .eq('id', user.id);

    if (updateError) {
        console.error('❌ 更新余额失败:', updateError);
        throw new Error(`更新余额失败: ${updateError.message}`);
    }

    // 记录充值日志
    const { error: logError } = await client
        .from('quota_logs')
        .insert({
            user_id: user.id,
            action_type: 'recharge',
            amount: amount,
            balance_after: newBalance,
            description: description
        });

    if (logError) {
        console.error('❌ 记录日志失败:', logError);
        // 日志失败不影响充值成功
    }

    console.log(`✅ 云端充值成功: +${amount}, 新余额: ${newBalance}`);
    return { ...profile, quota_balance: newBalance };
}

/**
 * 消耗额度
 * @param {number} amount - 消耗数量
 * @param {string} description - 描述
 * @param {number} taskId - 关联任务ID
 * @returns {Promise<Object>} 更新后的配置
 */
async function consumeQuotaCloud(amount, description = '', taskId = null) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    // 获取当前余额
    const profile = await getUserProfile();
    if (profile.quota_balance < amount) {
        throw new Error('额度不足');
    }

    const newBalance = profile.quota_balance - amount;

    // 更新余额
    await client
        .from('user_profiles')
        .update({
            quota_balance: newBalance,
            quota_used: profile.quota_used + amount
        })
        .eq('id', user.id);

    // 记录消费日志
    await client
        .from('quota_logs')
        .insert({
            user_id: user.id,
            action_type: 'consume',
            amount: -amount,
            balance_after: newBalance,
            description: description,
            task_id: taskId
        });

    return { ...profile, quota_balance: newBalance };
}

/**
 * 退还额度
 * @param {number} amount - 退还数量
 * @param {string} description - 描述
 * @returns {Promise<Object>} 更新后的配置
 */
async function refundQuotaCloud(amount, description = '') {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const profile = await getUserProfile();
    const newBalance = profile.quota_balance + amount;

    // 更新余额
    await client
        .from('user_profiles')
        .update({
            quota_balance: newBalance,
            quota_used: Math.max(0, profile.quota_used - amount)
        })
        .eq('id', user.id);

    // 记录退还日志
    await client
        .from('quota_logs')
        .insert({
            user_id: user.id,
            action_type: 'refund',
            amount: amount,
            balance_after: newBalance,
            description: description
        });

    return { ...profile, quota_balance: newBalance };
}

/**
 * 获取额度使用记录
 * @param {number} limit - 获取数量
 * @returns {Promise<Array>} 记录列表
 */
async function getQuotaLogs(limit = 50) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('quota_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// ==================== 邀请系统 ====================

/**
 * 验证邀请码是否有效
 * @param {string} inviteCode - 邀请码
 * @returns {Promise<{valid: boolean, message: string}>} 验证结果
 */
async function validateInviteCode(inviteCode) {
    if (!inviteCode || inviteCode.trim() === '') {
        return { valid: false, message: '请输入邀请码' };
    }
    
    const code = inviteCode.trim().toUpperCase();
    
    // 检查邀请码格式（NV开头+8位字符）
    if (!/^NV[A-Z0-9]{8}$/i.test(code)) {
        return { valid: false, message: '邀请码格式不正确' };
    }
    
    const client = getSupabase();
    if (!client) return { valid: false, message: '系统初始化失败' };
    
    try {
        // 查询邀请码是否存在
        const { data, error } = await client
            .from('user_profiles')
            .select('id, invite_code')
            .eq('invite_code', code)
            .single();
        
        if (error || !data) {
            return { valid: false, message: '邀请码不存在或已失效' };
        }
        
        return { valid: true, message: '邀请码有效' };
    } catch (e) {
        console.error('验证邀请码失败:', e);
        return { valid: false, message: '验证失败，请重试' };
    }
}

/**
 * 处理邀请奖励
 * @param {string} inviteeId - 被邀请人ID
 * @param {string} inviteCode - 邀请码
 * @returns {Promise<boolean>} 是否成功
 */
async function processInviteBonus(inviteeId, inviteCode) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const { data, error } = await client
        .rpc('process_invite_bonus', {
            p_invitee_id: inviteeId,
            p_invite_code: inviteCode
        });

    if (error) throw error;
    return data;
}

/**
 * 获取邀请记录
 * @returns {Promise<Array>} 邀请记录
 */
async function getInviteRecords() {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('invite_records')
        .select(`
            *,
            invitee:invitee_id(email, nickname, created_at)
        `)
        .eq('inviter_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// ==================== 卡密充值系统 ====================

/**
 * 兑换充值卡密
 * @param {string} cardCode - 卡密码
 * @returns {Promise<{success: boolean, message: string, newBalance: number}>}
 */
async function redeemCard(cardCode) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('请先登录后再兑换卡密');

    // 调用数据库函数兑换
    const { data, error } = await client
        .rpc('redeem_card', {
            p_user_id: user.id,
            p_card_code: cardCode.toUpperCase().trim()
        });

    if (error) throw error;

    // 返回结果
    if (data && data.length > 0) {
        return {
            success: data[0].success,
            message: data[0].message,
            newBalance: data[0].new_balance
        };
    }

    return { success: false, message: '兑换失败，请重试', newBalance: 0 };
}

/**
 * 获取充值记录
 * @param {number} limit - 获取数量
 * @returns {Promise<Array>}
 */
async function getRechargeHistory(limit = 20) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

    const user = await getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const { data, error } = await client
        .from('recharge_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// ==================== 导出 ====================

// 全局导出
window.NVAuth = {
    // 配置
    SUPABASE_URL,
    getSupabase,

    // 认证
    signUpWithEmail,
    signInWithEmail,
    signOut,
    getCurrentUser,
    onAuthStateChange,
    resetPassword,

    // 用户配置
    getUserProfile,
    updateUserProfile,

    // 任务
    syncTasksToCloud,
    getTasksFromCloud,
    deleteTaskFromCloud,

    // 角色
    syncCharactersToCloud,
    getCharactersFromCloud,

    // 设置
    syncSettingsToCloud,
    getSettingsFromCloud,

    // 额度
    addQuotaCloud,
    consumeQuotaCloud,
    refundQuotaCloud,
    getQuotaLogs,

    // 邀请
    validateInviteCode,
    processInviteBonus,
    getInviteRecords,

    // 卡密充值
    redeemCard,
    getRechargeHistory
};

console.log('✅ NVAuth 模块已加载');

