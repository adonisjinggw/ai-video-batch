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

// 🚀 本地缓存快速恢复（避免每次都请求海外 Supabase 服务器）
const AUTH_CACHE_KEY = 'rollroll_auth_cache';
const AUTH_CACHE_MAX_AGE = 30 * 60 * 1000; // 30分钟

// 🔧 移动端增强：多重存储备份（localStorage + sessionStorage + cookie）
function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('[Auth] localStorage 写入失败:', e.message);
    }
    try {
        sessionStorage.setItem(key, value);
    } catch (e) {}
    // 🔧 Cookie 备份（用于某些浏览器限制 localStorage 的情况）
    try {
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expiry}; path=/; SameSite=Lax`;
    } catch (e) {}
}

function safeStorageGet(key) {
    // 优先 localStorage
    try {
        const val = localStorage.getItem(key);
        if (val) return val;
    } catch (e) {}
    // 备份 sessionStorage
    try {
        const val = sessionStorage.getItem(key);
        if (val) return val;
    } catch (e) {}
    // 备份 Cookie
    try {
        const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
        if (match) return decodeURIComponent(match[2]);
    } catch (e) {}
    return null;
}

function safeStorageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    try { sessionStorage.removeItem(key); } catch (e) {}
    try { document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; } catch (e) {}
}

function saveAuthCache(user, session) {
    if (!user) {
        safeStorageRemove(AUTH_CACHE_KEY);
        return;
    }
    try {
        const cache = {
            user: { id: user.id, email: user.email },
            expiresAt: session?.expires_at || 0,
            accessToken: session?.access_token || '',  // 🆕 保存 token 用于恢复
            refreshToken: session?.refresh_token || '',
            cachedAt: Date.now()
        };
        safeStorageSet(AUTH_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('[Auth] 保存缓存失败:', e.message);
    }
}

function getAuthCache() {
    try {
        const raw = safeStorageGet(AUTH_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        // 检查缓存是否过期
        if (Date.now() - cache.cachedAt > AUTH_CACHE_MAX_AGE) {
            safeStorageRemove(AUTH_CACHE_KEY);
            return null;
        }
        // 检查 session 是否过期
        if (cache.expiresAt && cache.expiresAt * 1000 < Date.now()) {
            safeStorageRemove(AUTH_CACHE_KEY);
            return null;
        }
        return cache;
    } catch (e) {
        return null;
    }
}

// 🚀 快速检查登录状态（使用本地缓存，不等待网络）
function isLoggedInFast() {
    const cache = getAuthCache();
    return !!(cache && cache.user && cache.user.id);
}

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
                    supabaseClient.auth.onAuthStateChange(async (event, session) => {
                        __nvCachedSession = session || null;
                        __nvCachedUser = session?.user || null;
                        // 🚀 保存/清除本地认证缓存
                        saveAuthCache(session?.user || null, session);
                        try {
                            if (event === 'SIGNED_OUT') {
                                saveAuthCache(null, null); // 清除缓存
                                localStorage.removeItem('nv_user_profile');
                                localStorage.removeItem('membership_type');
                                localStorage.removeItem('vip_info');
                                localStorage.removeItem('vip_expiry');
                                localStorage.removeItem('film_balance');
                                localStorage.removeItem('cloud_film_balance');
                            }
                            // 🔄 登录成功后自动同步云端数据
                            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                                // 🔧 防止重复同步：检查是否已在同步中
                                if (window.__nvLoginSyncInProgress) {
                                    console.log('⏳ [登录同步] 已有同步任务在执行，跳过');
                                    return;
                                }
                                window.__nvLoginSyncInProgress = true;
                                
                                console.log('🔄 [登录同步] 开始同步云端数据...');
                                // 🔧 立即执行，不延迟（缩短等待时间）
                                try {
                                    // 只调用 syncDataFromCloud，它内部会处理余额同步
                                    if (typeof syncDataFromCloud === 'function') {
                                        await syncDataFromCloud();
                                    } else if (typeof refreshFilmBalanceFromCloud === 'function') {
                                        // 降级：如果 syncDataFromCloud 不存在，直接同步余额
                                        await refreshFilmBalanceFromCloud(true);
                                    }
                                    console.log('✅ [登录同步] 云端数据同步完成');
                                } catch (syncErr) {
                                    console.warn('⚠️ [登录同步] 部分数据同步失败:', syncErr?.message);
                                } finally {
                                    window.__nvLoginSyncInProgress = false;
                                }
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
    // 🚀 优先使用代理加速国内访问
    try {
        console.log('🚀 [注册] 尝试使用代理注册...');
        const proxyRes = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authSignUp', email, password, nickname, inviteCode })
        });
        
        const proxyData = await proxyRes.json();
        
        if (proxyRes.ok && proxyData.success && proxyData.user) {
            console.log('✅ [注册] 代理注册成功');
            
            // 如果返回了 token，存入 Supabase
            if (proxyData.access_token) {
                const client = getSupabase();
                if (client) {
                    await client.auth.setSession({
                        access_token: proxyData.access_token,
                        refresh_token: proxyData.refresh_token
                    });
                }
                __nvCachedUser = proxyData.user;
                __nvCachedSession = {
                    access_token: proxyData.access_token,
                    refresh_token: proxyData.refresh_token,
                    user: proxyData.user
                };
                saveAuthCache(proxyData.user, __nvCachedSession);
            }
            
            // 处理邀请码奖励
            if (inviteCode && proxyData.user?.id) {
                try {
                    await processInviteBonus(proxyData.user.id, inviteCode);
                } catch (e) {
                    console.warn('邀请码处理失败:', e.message);
                }
            }
            
            return { session: __nvCachedSession, user: proxyData.user };
        }
        
        // 代理返回错误
        if (proxyData.error || proxyData.message) {
            throw new Error(proxyData.message || proxyData.error || '注册失败');
        }
    } catch (proxyErr) {
        console.warn('⚠️ [注册] 代理注册失败，回退直连:', proxyErr.message);
        // 如果是明确的注册错误，直接抛出
        if (proxyErr.message && (proxyErr.message.includes('已被注册') || proxyErr.message.includes('already') || proxyErr.message.includes('registered'))) {
            throw proxyErr;
        }
    }
    
    // 回退：使用原始 Supabase SDK
    const client = getSupabase();
    if (!client) throw new Error('Supabase 未初始化');

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
    // 🚀 优先使用代理加速国内访问
    try {
        console.log('🚀 [登录] 尝试使用代理登录...');
        const proxyRes = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authSignIn', email, password })
        });
        
        const proxyData = await proxyRes.json();
        
        if (proxyRes.ok && proxyData.success && proxyData.access_token) {
            console.log('✅ [登录] 代理登录成功');
            
            // 将 token 存入 Supabase 本地存储，让 SDK 识别登录状态
            const client = getSupabase();
            if (client) {
                await client.auth.setSession({
                    access_token: proxyData.access_token,
                    refresh_token: proxyData.refresh_token
                });
            }
            
            // 更新缓存
            __nvCachedUser = proxyData.user;
            __nvCachedSession = {
                access_token: proxyData.access_token,
                refresh_token: proxyData.refresh_token,
                expires_at: proxyData.expires_at,
                user: proxyData.user
            };
            saveAuthCache(proxyData.user, __nvCachedSession);
            
            // 更新最后登录时间
            if (proxyData.user?.id) {
                updateLastLogin(proxyData.user.id).catch(() => {});
            }
            
            return { session: __nvCachedSession, user: proxyData.user };
        }
        
        // 代理返回错误
        if (proxyData.error || proxyData.message) {
            throw new Error(proxyData.message || proxyData.error || '登录失败');
        }
    } catch (proxyErr) {
        console.warn('⚠️ [登录] 代理登录失败，回退直连:', proxyErr.message);
        // 如果是明确的登录错误（密码错误等），直接抛出
        if (proxyErr.message && (proxyErr.message.includes('邮箱或密码') || proxyErr.message.includes('invalid') || proxyErr.message.includes('Invalid'))) {
            throw proxyErr;
        }
    }
    
    // 回退：使用原始 Supabase SDK
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
 * @param {boolean} forceRefresh - 是否强制刷新session（跳过缓存）
 * @returns {Promise<Object|null>} 当前用户信息
 */
async function getCurrentUser(forceRefresh = false) {
    // 🚀 优先使用内存缓存，最快返回
    if (!forceRefresh && __nvCachedUser) {
        // 🔄 后台检查 session 是否即将过期（不阻塞）
        if (__nvCachedSession?.expires_at) {
            const expiresAt = __nvCachedSession.expires_at * 1000;
            const fiveMinutes = 5 * 60 * 1000;
            if (expiresAt - Date.now() < fiveMinutes) {
                // 后台刷新，不等待
                refreshSessionBackground();
            }
        }
        return __nvCachedUser;
    }
    
    // 🚀 其次使用本地缓存
    const cache = getAuthCache();
    if (!forceRefresh && cache?.user) {
        __nvCachedUser = cache.user;
        // 🔄 后台验证并刷新
        refreshSessionBackground();
        return cache.user;
    }
    
    const client = getSupabase();
    if (!client) {
        return cache?.user || null;
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (data?.session?.user) {
            __nvCachedSession = data.session;
            __nvCachedUser = data.session.user;
            saveAuthCache(__nvCachedUser, __nvCachedSession);
            return __nvCachedUser;
        }
        
        // Session 为空，尝试从缓存恢复
        if (cache?.accessToken && cache?.refreshToken) {
            try {
                const { data: setData } = await client.auth.setSession({
                    access_token: cache.accessToken,
                    refresh_token: cache.refreshToken
                });
                if (setData?.session?.user) {
                    __nvCachedSession = setData.session;
                    __nvCachedUser = setData.session.user;
                    saveAuthCache(__nvCachedUser, __nvCachedSession);
                    return __nvCachedUser;
                }
            } catch (e) {}
        }
        
        return null;
    } catch (e) {
        console.warn('⚠️ [Auth] getSession异常:', e?.message);
        return cache?.user || null;
    }
}

// 🔄 后台刷新 Session（不阻塞页面）
let __refreshingSession = false;
async function refreshSessionBackground() {
    if (__refreshingSession) return;
    __refreshingSession = true;
    
    try {
        const client = getSupabase();
        if (!client) return;
        
        const { data } = await client.auth.refreshSession();
        if (data?.session) {
            __nvCachedSession = data.session;
            __nvCachedUser = data.session.user || null;
            saveAuthCache(__nvCachedUser, __nvCachedSession);
            console.log('✅ [Auth] 后台刷新Session成功');
        }
    } catch (e) {
        console.warn('⚠️ [Auth] 后台刷新失败:', e?.message);
    } finally {
        __refreshingSession = false;
    }
}

/**
 * 🆕 强制刷新Session
 * @returns {Promise<boolean>} 是否刷新成功
 */
async function refreshSession() {
    const client = getSupabase();
    if (!client) return false;
    
    try {
        const { data, error } = await client.auth.refreshSession();
        if (data?.session) {
            __nvCachedSession = data.session;
            __nvCachedUser = data.session.user || null;
            console.log('✅ [Auth] Session强制刷新成功');
            return true;
        }
        if (error) {
            console.warn('❌ [Auth] Session刷新失败:', error.message);
            __nvCachedSession = null;
            __nvCachedUser = null;
        }
        return false;
    } catch (e) {
        console.error('❌ [Auth] 刷新Session异常:', e?.message);
        return false;
    }
}

/**
 * 🆕 检查登录状态（带重试）
 * 用于API调用前确保用户已登录
 * @param {boolean} refreshQuota - 是否同时刷新胶片余额
 * @returns {Promise<{valid: boolean, user: Object|null, quota: number, message: string}>}
 */
async function checkAuthStatus(refreshQuota = true) {
    let user = await getCurrentUser();
    if (user) {
        let quota = 0;
        // 💰 同时获取最新胶片余额（防止使用过期缓存）
        if (refreshQuota) {
            try {
                const profile = await getUserProfile(user.id);
                quota = profile?.quota_balance || 0;
                // 🔄 同步到本地缓存
                localStorage.setItem('film_balance', String(quota));
                localStorage.setItem('cloud_film_balance', String(quota));
                console.log('🎞️ [Auth] 胶片余额已刷新:', quota);
            } catch (e) {
                // 回退使用本地缓存
                quota = parseFloat(localStorage.getItem('film_balance') || '0');
                console.warn('⚠️ [Auth] 获取胶片余额失败，使用缓存:', quota);
            }
        } else {
            quota = parseFloat(localStorage.getItem('film_balance') || '0');
        }
        return { valid: true, user, quota, message: '' };
    }
    
    // 第一次失败，尝试强制刷新
    console.log('🔄 [Auth] 用户为空，尝试刷新Session...');
    const refreshed = await refreshSession();
    if (refreshed) {
        user = await getCurrentUser();
        if (user) {
            let quota = 0;
            if (refreshQuota) {
                try {
                    const profile = await getUserProfile(user.id);
                    quota = profile?.quota_balance || 0;
                    localStorage.setItem('film_balance', String(quota));
                    localStorage.setItem('cloud_film_balance', String(quota));
                } catch (e) {
                    quota = parseFloat(localStorage.getItem('film_balance') || '0');
                }
            } else {
                quota = parseFloat(localStorage.getItem('film_balance') || '0');
            }
            return { valid: true, user, quota, message: '' };
        }
    }
    
    // 🚨 登录失败，清除本地缓存防止不一致
    localStorage.removeItem('film_balance');
    localStorage.removeItem('cloud_film_balance');
    saveAuthCache(null, null);
    
    return { valid: false, user: null, quota: 0, message: '登录已过期，请重新登录' };
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

    // 🔧 修复：把完整角色数据序列化到 tags 字段（JSONB）
    const charsToSync = characters.map(char => ({
        user_id: user.id,
        name: char.name,
        summary: char.summary || char.description || '',
        image_url: char.imageUrl || char.variants?.poster || char.posterUrl || '',
        video_url: char.videoUrl || '',
        // 🆕 把完整数据存入 tags 字段（滥用但有效）
        tags: { __full_data: char },
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

    // 🔧 修复：优先使用完整数据，兼容旧格式
    return data.map(row => {
        // 如果 tags 里有完整数据，直接使用
        if (row.tags && row.tags.__full_data) {
            return row.tags.__full_data;
        }
        // 兼容旧格式（没有 __full_data 的数据）
        return {
            name: row.name,
            summary: row.summary,
            imageUrl: row.image_url,
            posterUrl: row.image_url,  // 兼容
            videoUrl: row.video_url,
            variants: {
                poster: row.image_url,
                turnaround: row.image_url
            },
            tags: Array.isArray(row.tags) ? row.tags : [],
            isPublic: row.is_public
        };
    });
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
        // 🔧 修复：通过服务端 API 验证邀请码，绕过 RLS 限制
        // 因为 user_profiles 的 RLS 策略只允许用户查看自己的配置
        // 未登录用户无法直接查询其他用户的邀请码
        const response = await fetch('/api/supabase-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'validateInviteCode',
                inviteCode: code
            })
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('邀请码验证API失败:', response.status, errData);
            return { valid: false, message: errData?.message || '邀请码验证失败，请重试' };
        }
        
        const result = await response.json();
        return {
            valid: result.valid === true,
            message: result.message || (result.valid ? '邀请码有效' : '邀请码无效')
        };
    } catch (e) {
        console.error('验证邀请码失败:', e);
        return { valid: false, message: '验证失败，请检查网络后重试' };
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
    refreshSession,      // 🆕 强制刷新Session
    checkAuthStatus,     // 🆕 检查登录状态（带重试）
    isLoggedInFast,      // 🚀 快速检查登录状态（本地缓存）

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

// 🔧 移动端增强：页面可见时自动检查并刷新 Session
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            // 页面重新可见时，检查登录状态
            const cache = getAuthCache();
            if (cache?.user) {
                console.log('🔄 [Auth] 页面激活，检查Session状态...');
                const client = getSupabase();
                if (client) {
                    try {
                        const { data } = await client.auth.getSession();
                        if (!data?.session) {
                            // Session 丢失，尝试从缓存恢复
                            if (cache.accessToken && cache.refreshToken) {
                                console.log('🔄 [Auth] Session丢失，尝试恢复...');
                                await client.auth.setSession({
                                    access_token: cache.accessToken,
                                    refresh_token: cache.refreshToken
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ [Auth] 检查Session失败:', e.message);
                    }
                }
            }
        }
    });
    
    // 🔧 定期检查 Session 状态（每10分钟）
    setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        const cache = getAuthCache();
        if (!cache?.user) return;
        
        // 检查是否即将过期（提前10分钟刷新）
        if (cache.expiresAt) {
            const expiresAt = cache.expiresAt * 1000;
            const tenMinutes = 10 * 60 * 1000;
            if (expiresAt - Date.now() < tenMinutes) {
                console.log('🔄 [Auth] Session即将过期，主动刷新...');
                await refreshSession();
            }
        }
    }, 10 * 60 * 1000);  // 10分钟
}

