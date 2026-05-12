/**
 * Supabase 代理 API（纯 fetch 版本）
 * 用于绑过 CORS 限制，在服务端执行数据库操作
 */

const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
// service_role key - 有完全权限绕过 RLS
// ⚠️ 生产环境必须通过环境变量注入，禁止硬编码到仓库
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const crypto = require('crypto');

const RH_BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';
const RH_API_KEY = process.env.RUNNINGHUB_API_KEY || '';
const RH_HD_WEBAPP_ID = process.env.RUNNINGHUB_HD_WEBAPP_ID || '2002063789228978177';
const RH_HD_INSTANCE_TYPE = process.env.RUNNINGHUB_HD_INSTANCE_TYPE || 'plus';

const __inflightByUser = global.__RH_HD_INFLIGHT_BY_USER || new Map();
const __inflightByTask = global.__RH_HD_INFLIGHT_BY_TASK || new Map();
global.__RH_HD_INFLIGHT_BY_USER = __inflightByUser;
global.__RH_HD_INFLIGHT_BY_TASK = __inflightByTask;

function __getInflightCount(userId) {
    return Number(__inflightByUser.get(String(userId)) || 0);
}

function __incInflight(userId, taskId) {
    const uid = String(userId);
    const next = __getInflightCount(uid) + 1;
    __inflightByUser.set(uid, next);
    if (taskId) __inflightByTask.set(String(taskId), uid);
    return next;
}

function __decInflight(userId, taskId) {
    const uid = String(userId);
    const cur = __getInflightCount(uid);
    const next = Math.max(0, cur - 1);
    __inflightByUser.set(uid, next);
    if (taskId) __inflightByTask.delete(String(taskId));
    return next;
}

function __safeHash(input) {
    return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

async function __uploadVideoFromUrl(videoUrl) {
    if (!RH_API_KEY) throw new Error('SERVER_CONFIG_ERROR: missing RUNNINGHUB_API_KEY');
    const u = String(videoUrl || '').trim();
    if (!u) throw new Error('MISSING_VIDEO_URL');

    const r = await fetch(u, { method: 'GET' });
    if (!r.ok) {
        throw new Error(`VIDEO_FETCH_FAILED: ${r.status}`);
    }

    const contentType = r.headers.get('content-type') || 'video/mp4';
    const contentLength = Number(r.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 80 * 1024 * 1024) {
        throw new Error('VIDEO_TOO_LARGE');
    }

    const ab = await r.arrayBuffer();
    const size = ab.byteLength;
    if (size > 80 * 1024 * 1024) {
        throw new Error('VIDEO_TOO_LARGE');
    }

    const filename = `input_${__safeHash(u).slice(0, 12)}.mp4`;
    const form = new FormData();
    form.append('apiKey', RH_API_KEY);
    form.append('fileType', 'video');
    form.append('file', new Blob([ab], { type: contentType }), filename);

    const uploadUrl = `${RH_BASE_URL}/task/openapi/upload`;
    const up = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!up.ok) {
        const t = await up.text().catch(() => '');
        throw new Error(`RH_UPLOAD_FAILED: ${up.status} ${t || ''}`);
    }
    const j = await up.json().catch(() => ({}));
    if (Number(j?.code) !== 0) {
        throw new Error(`RH_UPLOAD_FAILED: ${j?.msg || 'unknown'}`);
    }
    const fileName = j?.data?.fileName;
    if (!fileName) throw new Error('RH_UPLOAD_NO_FILENAME');
    return String(fileName);
}

async function __rhRunHdTask(uploadedFileName) {
    if (!RH_API_KEY) throw new Error('SERVER_CONFIG_ERROR: missing RUNNINGHUB_API_KEY');

    const runUrl = `${RH_BASE_URL}/task/openapi/ai-app/run`;
    const body = {
        webappId: RH_HD_WEBAPP_ID,
        apiKey: RH_API_KEY,
        instanceType: RH_HD_INSTANCE_TYPE,
        nodeInfoList: [
            {
                nodeId: '62',
                fieldName: 'video',
                fieldValue: uploadedFileName,
                description: 'video'
            }
        ]
    };

    const r = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`RH_RUN_FAILED: ${r.status} ${t || ''}`);
    }
    const j = await r.json().catch(() => ({}));
    console.log('[supabase-proxy] RunningHub 返回:', JSON.stringify(j));
    
    // 检查API返回的错误码
    if (j?.code && j.code !== 0) {
        throw new Error(`RH_RUN_ERROR: ${j?.msg || j?.message || 'API返回错误'} (code: ${j.code})`);
    }
    
    const taskId = j?.data?.result?.taskId || j?.data?.taskId || j?.taskId;
    if (!taskId) {
        throw new Error(`RH_RUN_NO_TASK_ID: API未返回任务ID, 响应: ${JSON.stringify(j).substring(0, 200)}`);
    }
    return String(taskId);
}

async function __rhPollHdTask(taskId) {
    if (!RH_API_KEY) throw new Error('SERVER_CONFIG_ERROR: missing RUNNINGHUB_API_KEY');
    const url = `${RH_BASE_URL}/task/openapi/ai-app/result/${encodeURIComponent(String(taskId))}`;
    const r = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${RH_API_KEY}` }
    });
    if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`RH_POLL_FAILED: ${r.status} ${t || ''}`);
    }
    const j = await r.json().catch(() => ({}));
    const status = j?.data?.result?.taskStatus || j?.data?.taskStatus || j?.taskStatus;
    const outputs = j?.data?.result?.outputNodeList || j?.data?.outputNodeList || j?.outputNodeList || [];
    let videoUrl = '';
    if (Array.isArray(outputs)) {
        const candidates = outputs.filter(o => {
            const fv = String(o?.fieldValue || o?.value || '');
            const t = String(o?.type || '').toLowerCase();
            return t.includes('video') || fv.endsWith('.mp4') || fv.startsWith('http');
        });
        if (candidates.length) {
            const fv = candidates[0]?.fieldValue || candidates[0]?.value;
            videoUrl = String(fv || '');
        }
    }
    return { status: String(status || ''), videoUrl, raw: j };
}

module.exports = async function handler(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { action, userId, amount, description } = body || {};

        console.log('[supabase-proxy] 收到请求:', { action, userId, amount });

        // ========== 🚀 认证代理（解决国内访问 Supabase Auth 慢的问题）==========
        if (action === 'authSignIn') {
            const { email, password } = body || {};
            if (!email || !password) {
                res.status(400).json({ error: 'MISSING_CREDENTIALS', message: '缺少邮箱或密码' });
                return;
            }
            
            try {
                const authUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
                const authRes = await fetch(authUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const authData = await authRes.json().catch(() => ({}));
                
                if (!authRes.ok) {
                    console.error('[supabase-proxy] 登录失败:', authRes.status, authData);
                    res.status(authRes.status).json({
                        error: authData?.error || 'AUTH_FAILED',
                        message: authData?.error_description || authData?.msg || '登录失败'
                    });
                    return;
                }
                
                console.log('[supabase-proxy] ✅ 登录成功:', email);
                res.status(200).json({
                    success: true,
                    access_token: authData.access_token,
                    refresh_token: authData.refresh_token,
                    expires_in: authData.expires_in,
                    expires_at: authData.expires_at,
                    user: authData.user
                });
                return;
            } catch (e) {
                console.error('[supabase-proxy] 登录异常:', e.message);
                res.status(500).json({ error: 'AUTH_ERROR', message: e.message });
                return;
            }
        }
        
        if (action === 'authSignUp') {
            const { email, password, nickname, inviteCode } = body || {};
            if (!email || !password) {
                res.status(400).json({ error: 'MISSING_CREDENTIALS', message: '缺少邮箱或密码' });
                return;
            }
            
            try {
                const authUrl = `${SUPABASE_URL}/auth/v1/signup`;
                const authRes = await fetch(authUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email,
                        password,
                        data: {
                            nickname: nickname || email.split('@')[0],
                            invite_code_used: inviteCode || ''
                        }
                    })
                });
                
                const authData = await authRes.json().catch(() => ({}));
                
                if (!authRes.ok) {
                    console.error('[supabase-proxy] 注册失败:', authRes.status, authData);
                    res.status(authRes.status).json({
                        error: authData?.error || 'SIGNUP_FAILED',
                        message: authData?.error_description || authData?.msg || '注册失败'
                    });
                    return;
                }
                
                const userId = authData.user?.id;
                console.log('[supabase-proxy] ✅ 注册成功:', email, 'userId:', userId);
                
                // 🎁 为新用户创建 profile 并赠送胶片
                if (userId && SUPABASE_SERVICE_KEY) {
                    try {
                        const hasInviter = !!(inviteCode && inviteCode.trim());
                        const initialUnlock = hasInviter ? 500 : 100;  // 有邀请码解锁500，没邀请码解锁100
                        const GIFT_TOTAL = 100000;  // 所有新用户都赠送10万锁定胶片
                        
                        // 创建用户 profile
                        const profileUrl = `${SUPABASE_URL}/rest/v1/user_profiles`;
                        const profileRes = await fetch(profileUrl, {
                            method: 'POST',
                            headers: {
                                'apikey': SUPABASE_SERVICE_KEY,
                                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({
                                id: userId,
                                email: email,
                                nickname: nickname || email.split('@')[0],
                                quota_balance: initialUnlock,  // 可用胶片（已解锁）
                                quota_locked: GIFT_TOTAL,      // 锁定胶片（10万）
                                quota_used: 0,
                                membership_type: 'free',
                                membership_level: 0,
                                invite_code: inviteCode || null  // 记录邀请人
                            })
                        });
                        
                        if (profileRes.ok) {
                            console.log('[supabase-proxy] ✅ 用户profile创建成功，解锁胶片:', initialUnlock, '锁定胶片:', GIFT_TOTAL);
                            
                            // 1. 记录赠送胶片的日志（已解锁部分）
                            const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
                            await fetch(logUrl, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                    user_id: userId,
                                    action_type: 'gift_unlock',
                                    amount: initialUnlock,
                                    balance_after: initialUnlock,
                                    description: hasInviter ? '新用户注册（使用邀请码）解锁胶片' : '新用户注册解锁胶片'
                                })
                            });
                            
                            // 2. 创建锁定胶片记录（10万锁定胶片）
                            const lotsUrl = `${SUPABASE_URL}/rest/v1/film_lots`;
                            await fetch(lotsUrl, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                    user_id: userId,
                                    lot_type: 'locked_gift',
                                    amount_total: GIFT_TOTAL,
                                    amount_remaining: GIFT_TOTAL,
                                    description: '新用户注册赠送锁定胶片'
                                })
                            });
                            
                            // 3. 记录锁定胶片赠送日志
                            await fetch(logUrl, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                    user_id: userId,
                                    action_type: 'locked_gift',
                                    amount: GIFT_TOTAL,
                                    balance_after: GIFT_TOTAL,
                                    description: '新用户注册赠送10万锁定胶片'
                                })
                            });
                            
                            console.log('[supabase-proxy] ✅ 胶片赠送记录已保存（锁定:', GIFT_TOTAL, '已解锁:', initialUnlock, ')');
                        } else {
                            const errText = await profileRes.text();
                            console.error('[supabase-proxy] ⚠️ 用户profile创建失败:', profileRes.status, errText);
                        }
                    } catch (profileErr) {
                        console.error('[supabase-proxy] ⚠️ 创建用户profile异常:', profileErr.message);
                    }
                }
                
                res.status(200).json({
                    success: true,
                    access_token: authData.access_token,
                    refresh_token: authData.refresh_token,
                    user: authData.user
                });
                return;
            } catch (e) {
                console.error('[supabase-proxy] 注册异常:', e.message);
                res.status(500).json({ error: 'SIGNUP_ERROR', message: e.message });
                return;
            }
        }
        
        if (action === 'authRefresh') {
            const { refresh_token } = body || {};
            if (!refresh_token) {
                res.status(400).json({ error: 'MISSING_REFRESH_TOKEN', message: '缺少 refresh_token' });
                return;
            }
            
            try {
                const authUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
                const authRes = await fetch(authUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refresh_token })
                });
                
                const authData = await authRes.json().catch(() => ({}));
                
                if (!authRes.ok) {
                    res.status(authRes.status).json({
                        error: authData?.error || 'REFRESH_FAILED',
                        message: authData?.error_description || '刷新失败'
                    });
                    return;
                }
                
                res.status(200).json({
                    success: true,
                    access_token: authData.access_token,
                    refresh_token: authData.refresh_token,
                    expires_in: authData.expires_in,
                    expires_at: authData.expires_at,
                    user: authData.user
                });
                return;
            } catch (e) {
                res.status(500).json({ error: 'REFRESH_ERROR', message: e.message });
                return;
            }
        }
        
        if (action === 'authGetUser') {
            const { access_token } = body || {};
            if (!access_token) {
                res.status(400).json({ error: 'MISSING_ACCESS_TOKEN', message: '缺少 access_token' });
                return;
            }
            
            try {
                const authUrl = `${SUPABASE_URL}/auth/v1/user`;
                const authRes = await fetch(authUrl, {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${access_token}`
                    }
                });
                
                const authData = await authRes.json().catch(() => ({}));
                
                if (!authRes.ok) {
                    res.status(authRes.status).json({
                        error: authData?.error || 'GET_USER_FAILED',
                        message: authData?.error_description || '获取用户信息失败'
                    });
                    return;
                }
                
                res.status(200).json({ success: true, user: authData });
                return;
            } catch (e) {
                res.status(500).json({ error: 'GET_USER_ERROR', message: e.message });
                return;
            }
        }

        // ========== 🔄 云端任务同步代理（解决客户端 SSL 错误）==========
        if (action === 'getTasks') {
            if (!userId) {
                res.status(400).json({ error: 'MISSING_USER_ID', message: '缺少 userId' });
                return;
            }
            if (!SUPABASE_SERVICE_KEY) {
                res.status(500).json({ error: 'SERVER_CONFIG_ERROR', message: '未配置 SUPABASE_SERVICE_KEY' });
                return;
            }
            try {
                const queryUrl = `${SUPABASE_URL}/rest/v1/user_tasks?user_id=eq.${encodeURIComponent(userId)}&or=(is_deleted.eq.false,is_deleted.is.null)&order=updated_at.desc&select=*`;
                const queryRes = await fetch(queryUrl, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!queryRes.ok) {
                    const errText = await queryRes.text().catch(() => '');
                    console.error('[supabase-proxy] getTasks 查询失败:', queryRes.status, errText);
                    res.status(queryRes.status).json({ error: 'QUERY_FAILED', message: errText });
                    return;
                }
                const rows = await queryRes.json().catch(() => []);
                // 提取 task_data，与 supabase-config.js 中 getTasksFromCloud 逻辑一致
                const tasks = (rows || []).map(row => {
                    const taskData = row.task_data || {};
                    const id = row.task_id || taskData.id;
                    if (!id) return null;
                    return { ...taskData, id, theme: row.theme || taskData.theme || '未命名任务' };
                }).filter(Boolean);
                console.log(`[supabase-proxy] ✅ getTasks 成功: ${tasks.length} 条`);
                res.status(200).json({ success: true, tasks });
                return;
            } catch (e) {
                console.error('[supabase-proxy] getTasks 异常:', e.message);
                res.status(500).json({ error: 'PROXY_ERROR', message: e.message });
                return;
            }
        }

        if (action === 'getCharacters') {
            if (!userId) {
                res.status(400).json({ error: 'MISSING_USER_ID', message: '缺少 userId' });
                return;
            }
            if (!SUPABASE_SERVICE_KEY) {
                res.status(500).json({ error: 'SERVER_CONFIG_ERROR', message: '未配置 SUPABASE_SERVICE_KEY' });
                return;
            }
            try {
                const queryUrl = `${SUPABASE_URL}/rest/v1/user_characters?user_id=eq.${encodeURIComponent(userId)}&select=*`;
                const queryRes = await fetch(queryUrl, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!queryRes.ok) {
                    const errText = await queryRes.text().catch(() => '');
                    res.status(queryRes.status).json({ error: 'QUERY_FAILED', message: errText });
                    return;
                }
                const rows = await queryRes.json().catch(() => []);
                // 提取角色数据，与 supabase-config.js 中 getCharactersFromCloud 逻辑一致
                const characters = (rows || []).map(row => {
                    if (row.tags?.__full_data) return row.tags.__full_data;
                    return {
                        name: row.name || '未命名',
                        summary: row.summary || '',
                        description: row.summary || '',
                        imageUrl: row.image_url || '',
                        posterUrl: row.image_url || '',
                        videoUrl: row.video_url || '',
                        variants: { poster: row.image_url || '' }
                    };
                });
                console.log(`[supabase-proxy] ✅ getCharacters 成功: ${characters.length} 个`);
                res.status(200).json({ success: true, characters });
                return;
            } catch (e) {
                console.error('[supabase-proxy] getCharacters 异常:', e.message);
                res.status(500).json({ error: 'PROXY_ERROR', message: e.message });
                return;
            }
        }

        // ========== 验证邀请码（不需要 userId，公开 API）==========
        if (action === 'validateInviteCode') {
            const inviteCode = String(body?.inviteCode || '').trim().toUpperCase();
            
            if (!inviteCode) {
                res.status(200).json({ valid: false, message: '请输入邀请码' });
                return;
            }
            
            // 检查邀请码格式（NV开头+8位字符）
            if (!/^NV[A-Z0-9]{8}$/i.test(inviteCode)) {
                res.status(200).json({ valid: false, message: '邀请码格式不正确' });
                return;
            }
            
            if (!SUPABASE_SERVICE_KEY) {
                res.status(200).json({ valid: false, message: '服务器配置错误' });
                return;
            }
            
            try {
                // 使用 service_role 绕过 RLS 查询邀请码
                const queryHeaders = {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                };
                const queryUrl = `${SUPABASE_URL}/rest/v1/user_profiles?invite_code=eq.${encodeURIComponent(inviteCode)}&select=id,invite_code&limit=1`;
                const queryRes = await fetch(queryUrl, { headers: queryHeaders });
                
                if (!queryRes.ok) {
                    const errText = await queryRes.text();
                    console.error('[supabase-proxy] 邀请码查询失败:', queryRes.status, errText);
                    res.status(200).json({ valid: false, message: '邀请码验证失败，请稍后重试' });
                    return;
                }
                
                const rows = await queryRes.json().catch(() => []);
                
                if (!rows || rows.length === 0) {
                    res.status(200).json({ valid: false, message: '邀请码不存在或已失效' });
                    return;
                }
                
                console.log(`[supabase-proxy] ✅ 邀请码验证成功: ${inviteCode}`);
                res.status(200).json({ valid: true, message: '邀请码有效' });
                return;
            } catch (e) {
                console.error('[supabase-proxy] 邀请码验证异常:', e.message);
                res.status(200).json({ valid: false, message: '验证失败，请稍后重试' });
                return;
            }
        }

        // ========== RPC 调用（两阶段扣费）==========
        if (action === 'rpc') {
            const { rpc, rpcArgs } = body || {};
            if (!rpc) {
                res.status(400).json({ error: 'MISSING_RPC_NAME', message: '缺少 rpc 名称' });
                return;
            }
            if (!SUPABASE_SERVICE_KEY) {
                res.status(500).json({ error: 'SERVER_CONFIG_ERROR', message: '服务器未配置 SUPABASE_SERVICE_KEY' });
                return;
            }
            
            const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpc)}`;
            const rpcHeaders = {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };
            
            console.log('[supabase-proxy] RPC 调用:', rpc, rpcArgs);
            
            const rpcRes = await fetch(rpcUrl, {
                method: 'POST',
                headers: rpcHeaders,
                body: JSON.stringify(rpcArgs || {})
            });
            
            const rpcText = await rpcRes.text();
            let rpcData;
            try {
                rpcData = JSON.parse(rpcText);
            } catch (e) {
                rpcData = rpcText;
            }
            
            if (!rpcRes.ok) {
                console.error('[supabase-proxy] RPC 失败:', rpcRes.status, rpcData);
                // 透传 Supabase 真实错误
                res.status(rpcRes.status).json({
                    error: rpcData?.message || rpcData?.error || `RPC failed: ${rpcRes.status}`,
                    details: rpcData?.details || null,
                    hint: rpcData?.hint || null,
                    code: rpcData?.code || null,
                    raw: rpcData
                });
                return;
            }
            
            console.log('[supabase-proxy] RPC 成功:', rpc);
            res.status(200).json({ success: true, data: rpcData });
            return;
        }

        if (!action || !userId) {
            res.status(400).json({ error: 'MISSING_PARAMS', message: '缺少必要参数' });
            return;
        }

        if (!SUPABASE_SERVICE_KEY) {
            res.status(500).json({
                error: 'SERVER_CONFIG_ERROR',
                message: '服务器未配置 SUPABASE_SERVICE_KEY（service_role）环境变量'
            });
            return;
        }

        const headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };

        // 🔧 有效的 membership_type 值列表（数据库约束）
        const VALID_MEMBERSHIP_TYPES = ['free', 'creator', 'vip', 'pro', 'studio'];

        function __getNumericMembershipLevelFromProfileRow(row) {
            try {
                const lv = Number(row?.membership_level);
                if (Number.isFinite(lv) && lv > 0) return Math.max(0, Math.min(10, Math.floor(lv)));
            } catch (e) { }
            return getMembershipLevel(row?.membership_type || 'free');
        }

        const GIFT_TOTAL = 100000;
        // 🎁 解锁上限配置
        // - 无邀请码注册的免费用户：100积分
        // - 有邀请码注册的免费用户：500积分
        const GIFT_UNLOCK_LIMIT_NO_INVITE = 100;   // 无邀请码
        const GIFT_UNLOCK_LIMIT_WITH_INVITE = 500; // 有邀请码
        const GIFT_UNLOCK_LIMITS_BY_LEVEL = {
            0: 100,  // 🎁 免费用户基础100积分（有邀请码另算）
            1: 3000,
            2: 6000,
            3: 12000,
            4: 22000,
            5: 35000,
            6: 50000,
            7: 68000,
            8: 82000,
            9: 93000,
            10: 100000
        };

        function getMembershipLevel(membershipType) {
            const raw = String(membershipType || 'free').trim();
            if (!raw || raw === 'free') return 0;
            const m = raw.match(/^(?:lv)?\s*(\d{1,2})$/i);
            if (m && m[1]) {
                const n = parseInt(m[1], 10);
                if (Number.isFinite(n)) return Math.max(0, Math.min(10, n));
            }
            const map = {
                creator: 4,
                basic: 4,
                vip: 6,
                mid: 6,
                pro: 10,
                studio: 10
            };
            return map[raw] || 0;
        }

        async function getGiftUnlockedSum() {
            try {
                const q = `${SUPABASE_URL}/rest/v1/quota_logs?user_id=eq.${userId}&action_type=eq.gift_unlock&select=amount&limit=1000`;
                const r = await fetch(q, { headers });
                if (!r.ok) return 0;
                const rows = await r.json().catch(() => ([]));
                const sum = (Array.isArray(rows) ? rows : []).reduce((acc, it) => {
                    const v = Number(it && it.amount);
                    return acc + (Number.isFinite(v) ? v : 0);
                }, 0);
                return Math.max(0, Math.round(sum * 100) / 100);
            } catch (e) {
                return 0;
            }
        }

        async function fetchProfileRow() {
            // 尝试获取完整字段，如果失败则回退到基础字段
            const selectFull = 'quota_balance,quota_used,membership_type,membership_level,membership_expires_at,invited_by,free_video_count,nickname';
            const selectLegacy = 'quota_balance,quota_used,membership_type,invited_by,free_video_count,nickname';
            const url1 = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=${encodeURIComponent(selectFull)}`;
            const r1 = await fetch(url1, { headers });
            if (r1.ok) {
                const rows = await r1.json().catch(() => ([]));
                return rows?.[0] || null;
            }
            const url2 = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=${encodeURIComponent(selectLegacy)}`;
            const r2 = await fetch(url2, { headers });
            if (!r2.ok) {
                const errText = await r2.text();
                throw new Error(errText || `获取余额失败: ${r2.status}`);
            }
            const rows = await r2.json().catch(() => ([]));
            return rows?.[0] || null;
        }

        // 🔄 检查会员是否需要降级（会员到期）
        async function checkAndDowngradeMembership(row) {
            if (!row) return row;
            const membershipLevel = Number(row.membership_level || 0);
            if (membershipLevel <= 0) return row; // 免费用户无需降级

            const membershipExpiresAt = row.membership_expires_at ? new Date(row.membership_expires_at) : null;
            const now = new Date();

            let shouldDowngrade = false;
            let downgradeReason = '';

            // 检查：会员到期
            if (membershipExpiresAt && membershipExpiresAt < now) {
                shouldDowngrade = true;
                downgradeReason = `会员已于 ${membershipExpiresAt.toISOString()} 到期`;
            }

            if (shouldDowngrade) {
                console.log(`[supabase-proxy] 🔻 会员降级: ${userId}, 原等级: LV${membershipLevel}, 原因: ${downgradeReason}`);

                // 降级到免费用户
                const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
                const updateData = {
                    membership_level: 0,
                    membership_type: 'free',
                    membership_expires_at: null
                };

                try {
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify(updateData)
                    });

                    // 记录降级日志
                    const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
                    await fetch(logUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            user_id: userId,
                            action_type: 'membership_downgrade',
                            amount: 0,
                            balance_after: row.quota_balance || 0,
                            description: `会员降级: LV${membershipLevel} → 免费用户 (${downgradeReason})`
                        })
                    });

                    // 返回更新后的数据
                    return { ...row, membership_level: 0, membership_type: 'free', membership_expires_at: null };
                } catch (e) {
                    console.warn('[supabase-proxy] 会员降级失败:', e.message);
                }
            }

            return row;
        }

        async function checkFilmLotsSupported() {
            try {
                const testUrl = `${SUPABASE_URL}/rest/v1/film_lots?select=id&limit=1`;
                const r = await fetch(testUrl, { headers });
                return !!r.ok;
            } catch (e) {
                return false;
            }
        }

        function __round2(v) {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            // 🔧 修复：数据库字段是整数类型，必须返回整数
            return Math.floor(n);
        }

        async function fetchActiveLots(nowIso) {
            const q = `${SUPABASE_URL}/rest/v1/film_lots?user_id=eq.${userId}&amount_remaining=gt.0&expires_at=gt.${encodeURIComponent(nowIso)}&order=expires_at.asc&limit=1000&select=id,amount_remaining,expires_at,lot_type,status`;
            const r = await fetch(q, { headers });
            if (!r.ok) {
                const t = await r.text();
                throw new Error(t || `获取lots失败: ${r.status}`);
            }
            const rows = await r.json().catch(() => ([]));
            return Array.isArray(rows) ? rows : [];
        }

        async function insertLot(lotType, lotAmount, sourceText) {
            const now = Date.now();
            const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
            const payload = {
                user_id: userId,
                lot_type: lotType,
                amount_total: __round2(lotAmount),
                amount_remaining: __round2(lotAmount),
                created_at: new Date(now).toISOString(),
                expires_at: expiresAt,
                status: 'active',
                source: sourceText || null
            };
            const insUrl = `${SUPABASE_URL}/rest/v1/film_lots`;
            const insHeaders = { ...headers, Prefer: 'return=minimal' };
            const r = await fetch(insUrl, {
                method: 'POST',
                headers: insHeaders,
                body: JSON.stringify(payload)
            });
            if (!r.ok) {
                const t = await r.text();
                throw new Error(t || `插入lot失败: ${r.status}`);
            }
            return true;
        }

        // 获取用户信息并检查会员降级
        let profileRow = await fetchProfileRow();
        
        // 🔧 如果用户不存在，返回错误而不是继续执行
        if (!profileRow) {
            console.error(`[supabase-proxy] 用户不存在: ${userId}`);
            res.status(404).json({ error: 'USER_NOT_FOUND', message: '用户不存在，请重新登录' });
            return;
        }
        
        profileRow = await checkAndDowngradeMembership(profileRow); // 🔄 自动降级检查

        // ========== 🎬 免费视频生成次数检查和扣减 ==========
        if (action === 'checkFreeVideoCount') {
            const membershipLevel = __getNumericMembershipLevelFromProfileRow(profileRow);
            const freeVideoCount = Number(profileRow?.free_video_count) || 0;
            const isVip = membershipLevel > 0;
            const canUseFree = isVip || freeVideoCount > 0;
            res.status(200).json({
                success: true,
                freeVideoCount,
                isVip,
                canUseFree,
                message: isVip ? 'VIP用户无限制' : (canUseFree ? `剩余免费次数：${freeVideoCount}` : '免费次数已用完')
            });
            return;
        }

        if (action === 'useFreeVideo') {
            const membershipLevel = __getNumericMembershipLevelFromProfileRow(profileRow);
            const isVip = membershipLevel > 0;
            
            if (isVip) {
                res.status(200).json({
                    success: true,
                    usedFree: false,
                    isVip: true,
                    message: 'VIP用户无需使用免费次数'
                });
                return;
            }
            
            const freeVideoCount = Number(profileRow?.free_video_count) || 0;
            if (freeVideoCount <= 0) {
                res.status(400).json({
                    error: 'NO_FREE_VIDEOS',
                    message: '免费次数已用完，请充值后继续使用'
                });
                return;
            }
            
            const newFreeVideoCount = freeVideoCount - 1;
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
            const updateData = { free_video_count: newFreeVideoCount };
            
            try {
                await fetch(updateUrl, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(updateData)
                });
                
                const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
                await fetch(logUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: userId,
                        action_type: 'free_video_used',
                        amount: -1,
                        balance_after: newFreeVideoCount,
                        description: '使用免费视频生成次数'
                    })
                });
                
                res.status(200).json({
                    success: true,
                    usedFree: true,
                    remaining: newFreeVideoCount,
                    message: `已使用免费次数，剩余 ${newFreeVideoCount} 次`
                });
                return;
            } catch (e) {
                res.status(500).json({ error: 'UPDATE_FAILED', message: e.message });
                return;
            }
        }

        const currentBalance = profileRow?.quota_balance || 0;
        const currentUsed = profileRow?.quota_used || 0;
        const currentMembershipType = profileRow?.membership_type || 'free';
        const hasGiftBalanceField = profileRow && Object.prototype.hasOwnProperty.call(profileRow, 'gift_film_balance');
        const filmLotsSupported = await checkFilmLotsSupported();

        if (action === 'runninghubHdStart' || action === 'runninghubHdPoll' || action === 'runninghubHdCancel') {
            const lv = __getNumericMembershipLevelFromProfileRow(profileRow);
            if (lv < 10) {
                res.status(403).json({ error: 'VIP10_REQUIRED', membershipLevel: lv });
                return;
            }
            if (!RH_API_KEY) {
                res.status(500).json({ error: 'SERVER_CONFIG_ERROR', message: '服务器未配置 RUNNINGHUB_API_KEY' });
                return;
            }

            if (action === 'runninghubHdStart') {
                const inflight = __getInflightCount(userId);
                if (inflight >= 5) {
                    res.status(429).json({ error: 'HD_CONCURRENCY_LIMIT', message: '最多同时进行 5 个高清任务', inflight });
                    return;
                }

                const videoUrl = String(body?.videoUrl || '').trim();
                if (!videoUrl) {
                    res.status(400).json({ error: 'MISSING_VIDEO_URL' });
                    return;
                }

                try {
                    const uploaded = await __uploadVideoFromUrl(videoUrl);
                    const taskId = await __rhRunHdTask(uploaded);
                    const next = __incInflight(userId, taskId);
                    res.status(200).json({ success: true, taskId, uploadedFile: uploaded, inflight: next });
                    return;
                } catch (e) {
                    res.status(500).json({ error: 'HD_START_FAILED', message: e?.message || String(e || '') });
                    return;
                }
            }

            if (action === 'runninghubHdPoll') {
                const taskId = String(body?.taskId || '').trim();
                if (!taskId) {
                    res.status(400).json({ error: 'MISSING_TASK_ID' });
                    return;
                }

                try {
                    const data = await __rhPollHdTask(taskId);
                    const st = String(data?.status || '').toUpperCase();
                    const done = (st === 'SUCCESS' || st === 'COMPLETED' || st === 'FAILED' || st === 'FAILURE' || st === 'ERROR');
                    if (done) __decInflight(userId, taskId);
                    res.status(200).json({ success: true, ...data });
                    return;
                } catch (e) {
                    res.status(500).json({ error: 'HD_POLL_FAILED', message: e?.message || String(e || '') });
                    return;
                }
            }

            if (action === 'runninghubHdCancel') {
                const taskId = String(body?.taskId || '').trim();
                if (taskId) __decInflight(userId, taskId);
                res.status(200).json({ success: true });
                return;
            }
        }

        if (action === 'activityHeartbeat') {
            const seconds = Math.max(10, Math.min(600, Number(body?.seconds) || 60));
            const nowIso = new Date().toISOString();
            const day = nowIso.slice(0, 10);
            const baseSelect = `${SUPABASE_URL}/rest/v1/user_daily_activity?user_id=eq.${encodeURIComponent(String(userId))}&day=eq.${encodeURIComponent(day)}&select=user_id,day,seconds_total&limit=1`;

            let nextTotal = seconds;
            try {
                const r = await fetch(baseSelect, { headers });
                if (r.ok) {
                    const rows = await r.json().catch(() => ([]));
                    const prev = Number(rows?.[0]?.seconds_total || 0);
                    nextTotal = Math.max(0, prev) + seconds;
                }
            } catch (e) { }

            try {
                const patchUrl = `${SUPABASE_URL}/rest/v1/user_daily_activity?user_id=eq.${encodeURIComponent(String(userId))}&day=eq.${encodeURIComponent(day)}`;
                const patchRes = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ seconds_total: nextTotal, last_seen_at: nowIso })
                });

                if (!patchRes.ok) {
                    const insUrl = `${SUPABASE_URL}/rest/v1/user_daily_activity`;
                    const insHeaders = { ...headers, Prefer: 'return=minimal' };
                    const insRes = await fetch(insUrl, {
                        method: 'POST',
                        headers: insHeaders,
                        body: JSON.stringify({ user_id: userId, day, seconds_total: nextTotal, last_seen_at: nowIso })
                    });
                    if (!insRes.ok) {
                        const t = await insRes.text();
                        res.status(500).json({ error: 'ACTIVITY_HEARTBEAT_FAILED', message: t || '写入活跃时长失败' });
                        return;
                    }
                }
            } catch (e) {
                res.status(500).json({ error: 'ACTIVITY_HEARTBEAT_FAILED', message: e?.message || String(e || '') });
                return;
            }

            res.status(200).json({ success: true, day, secondsTotal: nextTotal });
            return;
        }

        // ========== VIP会员激活 ==========
        if (action === 'activateVip') {
            const { membershipType, duration, membershipLevel } = body;
            // membershipType: 'vip' | 'pro' | 'creator' | 'lv1'-'lv10'
            // duration: 'permanent' | 'monthly' | 'yearly' | 'quarterly'
            // membershipLevel: 1-10 (可选，用于LV等级体系)

            if (!membershipType) {
                res.status(400).json({ error: 'MISSING_VIP_TYPE', message: '缺少会员类型' });
                return;
            }

            // 🔧 支持LV等级格式：lv1-lv10
            let safeMembershipType = membershipType;
            let safeMembershipLevel = membershipLevel || null;

            // 检查是否是LV格式
            const lvMatch = String(membershipType).match(/^lv(\d{1,2})$/i);
            if (lvMatch) {
                // LV格式：数据库约束只允许 free/creator/vip/pro/studio
                // 所以根据等级映射到对应的 membership_type，用 membership_level 存储实际等级
                safeMembershipLevel = parseInt(lvMatch[1], 10);
                // LV1-3 -> creator, LV4-6 -> vip, LV7-10 -> pro
                safeMembershipType = safeMembershipLevel >= 7 ? 'pro' : (safeMembershipLevel >= 4 ? 'vip' : 'creator');
                console.log(`[supabase-proxy] 🎖️ LV等级激活: type=${safeMembershipType}, level=${safeMembershipLevel}`);
            } else if (!VALID_MEMBERSHIP_TYPES.includes(membershipType)) {
                console.warn(`[supabase-proxy] ⚠️ 无效的membershipType: ${membershipType}, 自动修正为 'vip'`);
                // 自动修正无效值
                if (membershipType === 'mid' || membershipType === 'basic') {
                    safeMembershipType = 'vip';
                } else {
                    safeMembershipType = 'vip'; // 默认修正为vip
                }
            }

            // 🔧 容错：如果用户当前的 membership_type 是无效值，需要特殊处理
            if (currentMembershipType && !VALID_MEMBERSHIP_TYPES.includes(currentMembershipType) && !currentMembershipType.match(/^lv\d{1,2}$/i)) {
                console.log(`[supabase-proxy] 🔧 检测到用户旧数据无效: ${currentMembershipType}, 将更新为: ${safeMembershipType}`);
            }

            // 计算过期时间
            let expiresAt = null;
            if (duration === 'monthly') {
                expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            } else if (duration === 'quarterly') {
                expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
            } else if (duration === 'yearly') {
                expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            }
            // permanent = null (永久)

            // 更新会员状态（使用验证后的安全值）
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
            const updateData = { membership_type: safeMembershipType };

            // 如果有等级数字，也更新 membership_level 字段
            if (safeMembershipLevel !== null && Number.isFinite(safeMembershipLevel)) {
                updateData.membership_level = safeMembershipLevel;
            }

            console.log('[supabase-proxy] 更新VIP状态:', updateUrl, updateData);

            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(updateData)
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                console.error('[supabase-proxy] VIP激活失败:', updateRes.status, errText);
                res.status(500).json({ error: 'VIP_ACTIVATE_FAILED', message: `激活失败: ${updateRes.status} - ${errText}` });
                return;
            }

            // 记录日志
            try {
                const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
                const levelDesc = safeMembershipLevel ? `LV${safeMembershipLevel}` : safeMembershipType.toUpperCase();
                const durationDesc = duration === 'permanent' ? '永久' : duration === 'yearly' ? '年卡' : duration === 'quarterly' ? '季卡' : '月卡';
                await fetch(logUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: userId,
                        action_type: 'vip_activate',
                        amount: 0,
                        balance_after: currentBalance,
                        description: `激活${levelDesc}会员 (${durationDesc})`
                    })
                });
            } catch (logErr) {
                console.warn('[supabase-proxy] VIP日志记录失败:', logErr.message);
            }

            console.log(`[supabase-proxy] ✅ VIP激活成功: ${safeMembershipType} (${duration})${safeMembershipLevel ? ', level=' + safeMembershipLevel : ''}`);

            res.status(200).json({
                success: true,
                membershipType: safeMembershipType,
                membershipLevel: safeMembershipLevel,
                expiresAt,
                message: `${safeMembershipLevel ? 'LV' + safeMembershipLevel : safeMembershipType.toUpperCase()}会员激活成功！`
            });
            return;
        }

        // ========== 获取用户完整信息 ==========
        if (action === 'getProfile') {
            // 🔧 直接返回 quota_balance，不使用 lots 系统
            res.status(200).json({
                success: true,
                quotaBalance: currentBalance,
                quotaUsed: currentUsed,
                membershipType: currentMembershipType,
                membershipLevel: profileRow?.membership_level || 0
            });
            return;
        }

        // ========== 获取用户配置(返回完整 profile 对象，供前端 getUserProfile 使用) ==========
        if (action === 'getUserProfile') {
            res.status(200).json({
                success: true,
                profile: profileRow || null
            });
            return;
        }

        // ========== 获取解锁状态 ==========
        if (action === 'giftUnlockStatus') {
            const totalGift = GIFT_TOTAL;
            const membership = currentMembershipType || 'free';
            const membershipLevel = __getNumericMembershipLevelFromProfileRow(profileRow);
            
            // 🎁 判断是否通过邀请码注册（invited_by 不为空）
            const hasInviter = !!profileRow?.invited_by;
            
            // 🎁 计算解锁上限：
            // - 免费用户（level 0）：有邀请码=500，无邀请码=100
            // - VIP用户：按等级解锁
            let limit;
            if (membershipLevel === 0) {
                limit = hasInviter ? GIFT_UNLOCK_LIMIT_WITH_INVITE : GIFT_UNLOCK_LIMIT_NO_INVITE;
            } else {
                limit = Math.max(0, Math.min(totalGift, Number(GIFT_UNLOCK_LIMITS_BY_LEVEL[membershipLevel] ?? 0)));
            }
            
            // 获取已解锁总额
            let unlocked = 0;
            try {
                unlocked = await getGiftUnlockedSum();
            } catch (e) {
                console.warn('[supabase-proxy] 获取已解锁额度失败:', e.message);
            }
            
            const cappedUnlocked = Math.max(0, Math.min(totalGift, unlocked));
            const canUnlock = Math.max(0, Math.min(limit, totalGift) - cappedUnlocked);
            
            console.log('[supabase-proxy] giftUnlockStatus:', { userId, membershipLevel, hasInviter, limit, unlocked, canUnlock });
            
            res.status(200).json({
                success: true,
                totalGift,
                membershipType: membership,
                membershipLevel,
                hasInviter,
                unlockLimit: limit,
                unlocked: cappedUnlocked,
                canUnlock,
                newBalance: currentBalance
            });
            return;
        }

        if (action === 'claimGiftUnlock') {
            // 🚥 安全修复：禁止用户主动领取赠送胶片
            // 赠送胶片只在新用户注册时由系统自动发放，不允许用户手动领取
            res.status(403).json({
                success: false,
                error: 'GIFT_CLAIM_DISABLED',
                message: '赠送胶片已在注册时自动发放，无需手动领取'
            });
            return;

            // 以下代码已禁用 ↓↓↓
            const totalGift = GIFT_TOTAL;
            const membership = currentMembershipType || 'free';
            // 🔧 修复：使用数据库中的 membership_level 字段，而不是从 membership_type 推断
            const membershipLevel = __getNumericMembershipLevelFromProfileRow(profileRow);
            const limit = Math.max(0, Math.min(totalGift, Number(GIFT_UNLOCK_LIMITS_BY_LEVEL[membershipLevel] ?? 0)));
            
            // 🔧 修复：严格获取已解锁总额，失败时拒绝操作而不是返回0
            let unlocked = 0;
            let unlockedQuerySuccess = false;
            try {
                const q = `${SUPABASE_URL}/rest/v1/quota_logs?user_id=eq.${userId}&action_type=eq.gift_unlock&select=amount&limit=1000`;
                const r = await fetch(q, { headers });
                if (r.ok) {
                    const rows = await r.json().catch(() => null);
                    if (Array.isArray(rows)) {
                        unlocked = rows.reduce((acc, it) => {
                            const v = Number(it && it.amount);
                            return acc + (Number.isFinite(v) ? v : 0);
                        }, 0);
                        unlockedQuerySuccess = true;
                    }
                }
            } catch (e) {
                console.error('[supabase-proxy] claimGiftUnlock 查询已解锁额度失败:', e.message);
            }
            
            // 🔧 如果查询失败，拒绝操作，防止重复解锁
            if (!unlockedQuerySuccess) {
                res.status(500).json({ 
                    error: 'GIFT_UNLOCK_QUERY_FAILED', 
                    message: '无法验证已解锁额度，请稍后重试' 
                });
                return;
            }
            
            const cappedUnlocked = Math.max(0, Math.min(totalGift, unlocked));
            const canUnlock = Math.max(0, Math.min(limit, totalGift) - cappedUnlocked);
            
            console.log('[supabase-proxy] claimGiftUnlock:', { userId, membershipLevel, limit, unlocked, cappedUnlocked, canUnlock });

            if (canUnlock <= 0) {
                // 🔧 修复：返回总余额（lots + quota_balance）
                let totalBalance = currentBalance;
                if (filmLotsSupported) {
                    try {
                        const nowIso = new Date().toISOString();
                        const lots = await fetchActiveLots(nowIso).catch(() => []);
                        const lotSum = (Array.isArray(lots) ? lots : []).reduce((acc, it) => acc + (Number(it?.amount_remaining) || 0), 0);
                        totalBalance = __round2(lotSum + currentBalance);
                    } catch (e) { }
                }
                res.status(200).json({
                    success: true,
                    delta: 0,
                    totalGift,
                    membershipType: membership,
                    membershipLevel,
                    unlockLimit: limit,
                    unlocked: cappedUnlocked,
                    canUnlock: 0,
                    newBalance: totalBalance,
                    message: '当前等级暂无可解锁额度'
                });
                return;
            }

            // 🔧 修复：只插入 lot，不更新 quota_balance，避免双重计算
            // 因为 consume 操作会先从 lots 扣费，lots 的余额已经计入总可用额度
            let newBalance = currentBalance;  // 保持 quota_balance 不变
            if (filmLotsSupported) {
                try {
                    await insertLot('unlocked', canUnlock, 'gift_unlock');
                    // 计算新的总可用余额（lots + quota_balance）
                    const nowIso = new Date().toISOString();
                    const lots = await fetchActiveLots(nowIso).catch(() => []);
                    const lotSum = (Array.isArray(lots) ? lots : []).reduce((acc, it) => acc + (Number(it?.amount_remaining) || 0), 0);
                    newBalance = __round2(lotSum + currentBalance);
                } catch (e) {
                    console.warn('[supabase-proxy] gift_unlock 写入lot失败，回退旧余额逻辑:', e.message);
                    // 如果 lot 写入失败，才更新 quota_balance
                    newBalance = __round2(Number(currentBalance || 0) + canUnlock);
                    const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
                    const updateRes = await fetch(updateUrl, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ quota_balance: newBalance })
                    });
                    if (!updateRes.ok) {
                        const errText = await updateRes.text();
                        res.status(500).json({ error: 'GIFT_UNLOCK_UPDATE_FAILED', message: errText || '更新余额失败' });
                        return;
                    }
                }
            } else {
                // 不支持 lots，直接更新 quota_balance
                newBalance = __round2(Number(currentBalance || 0) + canUnlock);
                const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
                const updateRes = await fetch(updateUrl, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ quota_balance: newBalance })
                });
                if (!updateRes.ok) {
                    const errText = await updateRes.text();
                    res.status(500).json({ error: 'GIFT_UNLOCK_UPDATE_FAILED', message: errText || '更新余额失败' });
                    return;
                }
            }

            try {
                const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
                await fetch(logUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: userId,
                        action_type: 'gift_unlock',
                        amount: canUnlock,
                        balance_after: newBalance,
                        description: `gift_unlock (${membership})`
                    })
                });
            } catch (logErr) {
                console.warn('[supabase-proxy] gift_unlock 日志记录失败:', logErr.message);
            }

            res.status(200).json({
                success: true,
                delta: canUnlock,
                totalGift,
                membershipType: membership,
                membershipLevel,
                unlockLimit: limit,
                unlocked: Math.max(0, Math.min(totalGift, cappedUnlocked + canUnlock)),
                canUnlock: 0,
                newBalance,
                message: `已解锁 ${canUnlock} 胶片`
            });
            return;
        }

        if (action === 'createGenerationTask') {
            const { provider, model, idempotencyKey, requestBody, prompt, meta } = body || {};
            const insertUrl = `${SUPABASE_URL}/rest/v1/generation_tasks`;
            const insertHeaders = { ...headers, Prefer: 'return=representation' };
            const payload = {
                user_id: userId,
                provider: provider || 'unknown',
                model: model || null,
                idempotency_key: idempotencyKey || null,
                status: 'running',
                prompt: prompt || null,
                request_body: requestBody || null,
                meta: meta || null
            };

            const insRes = await fetch(insertUrl, {
                method: 'POST',
                headers: insertHeaders,
                body: JSON.stringify(payload)
            });

            if (!insRes.ok) {
                const errText = await insRes.text();
                res.status(500).json({ error: 'CREATE_TASK_FAILED', message: errText || '创建任务失败' });
                return;
            }

            const rows = await insRes.json().catch(() => ([]));
            const taskId = rows?.[0]?.id;
            res.status(200).json({ success: true, taskId });
            return;
        }

        if (action === 'updateGenerationTask') {
            const { taskId, patch } = body || {};
            if (!taskId) {
                res.status(400).json({ error: 'MISSING_TASK_ID', message: '缺少taskId' });
                return;
            }
            const updateUrl = `${SUPABASE_URL}/rest/v1/generation_tasks?id=eq.${taskId}&user_id=eq.${userId}`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(patch || {})
            });
            if (!updateRes.ok) {
                const errText = await updateRes.text();
                res.status(500).json({ error: 'UPDATE_TASK_FAILED', message: errText || '更新任务失败' });
                return;
            }
            res.status(200).json({ success: true });
            return;
        }

        if (action === 'getGenerationTask') {
            const { taskId } = body || {};
            if (!taskId) {
                res.status(400).json({ error: 'MISSING_TASK_ID', message: '缺少taskId' });
                return;
            }
            const getTaskUrl = `${SUPABASE_URL}/rest/v1/generation_tasks?id=eq.${taskId}&user_id=eq.${userId}&select=*`;
            const getTaskRes = await fetch(getTaskUrl, { headers });
            if (!getTaskRes.ok) {
                const errText = await getTaskRes.text();
                res.status(500).json({ error: 'GET_TASK_FAILED', message: errText || '获取任务失败' });
                return;
            }
            const rows = await getTaskRes.json().catch(() => ([]));
            res.status(200).json({ success: true, task: rows?.[0] || null });
            return;
        }

        if (action === 'listGenerationTasks') {
            const { limit = 20, provider } = body || {};
            const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
            const filters = [`user_id=eq.${userId}`];
            if (provider) filters.push(`provider=eq.${encodeURIComponent(String(provider))}`);
            const listUrl = `${SUPABASE_URL}/rest/v1/generation_tasks?${filters.join('&')}&order=created_at.desc&limit=${safeLimit}`;
            const listRes = await fetch(listUrl, { headers });
            if (!listRes.ok) {
                const errText = await listRes.text();
                res.status(500).json({ error: 'LIST_TASKS_FAILED', message: errText || '获取任务列表失败' });
                return;
            }
            const rows = await listRes.json().catch(() => ([]));
            res.status(200).json({ success: true, tasks: rows });
            return;
        }

        function __roleRank(role) {
            const r = String(role || '').toLowerCase();
            if (r === 'owner') return 3;
            if (r === 'editor') return 2;
            if (r === 'viewer' || r === 'read' || r === 'readonly') return 1;
            return 0;
        }

        async function __getProjectAccess(projectId) {
            const pid = String(projectId || '').trim();
            if (!pid) return { allowed: false, project: null, role: null };

            const pUrl = `${SUPABASE_URL}/rest/v1/writing_projects?id=eq.${encodeURIComponent(pid)}&select=*`;
            const pRes = await fetch(pUrl, { headers });
            if (!pRes.ok) {
                const errText = await pRes.text();
                throw new Error(errText || `GET_PROJECT_FAILED: ${pRes.status}`);
            }
            const pRows = await pRes.json().catch(() => ([]));
            const project = pRows?.[0] || null;
            if (!project || project.is_deleted) return { allowed: false, project: null, role: null };

            if (String(project.owner_id) === String(userId)) {
                return { allowed: true, project, role: 'owner' };
            }

            const cUrl = `${SUPABASE_URL}/rest/v1/writing_collaborators?project_id=eq.${encodeURIComponent(pid)}&user_id=eq.${encodeURIComponent(userId)}&select=role`;
            const cRes = await fetch(cUrl, { headers });
            if (!cRes.ok) {
                const errText = await cRes.text();
                throw new Error(errText || `GET_COLLAB_FAILED: ${cRes.status}`);
            }
            const cRows = await cRes.json().catch(() => ([]));
            const role = cRows?.[0]?.role || null;
            if (!role) return { allowed: false, project: null, role: null };
            return { allowed: true, project, role };
        }

        async function __requireProjectRole(projectId, minRole) {
            const access = await __getProjectAccess(projectId);
            if (!access.allowed) return { ok: false, access: null };
            const has = __roleRank(access.role);
            const need = __roleRank(minRole);
            if (has < need) return { ok: false, access: null };
            return { ok: true, access };
        }

        async function __getChapterById(chapterId) {
            const cid = String(chapterId || '').trim();
            if (!cid) return null;
            const url = `${SUPABASE_URL}/rest/v1/writing_chapters?id=eq.${encodeURIComponent(cid)}&select=*`;
            const r = await fetch(url, { headers });
            if (!r.ok) {
                const errText = await r.text();
                throw new Error(errText || `GET_CHAPTER_FAILED: ${r.status}`);
            }
            const rows = await r.json().catch(() => ([]));
            const ch = rows?.[0] || null;
            if (!ch || ch.is_deleted) return null;
            return ch;
        }

        if (action === 'writingCreateProject') {
            const { title = '', projectType = 'novel', meta = {} } = body || {};
            const insertUrl = `${SUPABASE_URL}/rest/v1/writing_projects`;
            const insertHeaders = { ...headers, Prefer: 'return=representation' };
            const payload = {
                owner_id: userId,
                title: String(title || ''),
                project_type: String(projectType || 'novel'),
                meta: meta && typeof meta === 'object' ? meta : {}
            };
            const insRes = await fetch(insertUrl, {
                method: 'POST',
                headers: insertHeaders,
                body: JSON.stringify(payload)
            });
            if (!insRes.ok) {
                const errText = await insRes.text();
                res.status(500).json({ error: 'WRITING_CREATE_PROJECT_FAILED', message: errText || '创建写作项目失败' });
                return;
            }
            const rows = await insRes.json().catch(() => ([]));
            const project = rows?.[0] || null;
            if (project?.id) {
                try {
                    const cUrl = `${SUPABASE_URL}/rest/v1/writing_collaborators`;
                    await fetch(cUrl, {
                        method: 'POST',
                        headers: { ...headers, Prefer: 'return=minimal' },
                        body: JSON.stringify({ project_id: project.id, user_id: userId, role: 'owner', invited_by: userId })
                    });
                } catch (e) {
                }
            }
            res.status(200).json({ success: true, project });
            return;
        }

        if (action === 'writingListProjects') {
            const ownedUrl = `${SUPABASE_URL}/rest/v1/writing_projects?owner_id=eq.${encodeURIComponent(userId)}&is_deleted=is.false&order=updated_at.desc&select=*`;
            const ownedRes = await fetch(ownedUrl, { headers });
            if (!ownedRes.ok) {
                const errText = await ownedRes.text();
                res.status(500).json({ error: 'WRITING_LIST_PROJECTS_FAILED', message: errText || '获取项目失败' });
                return;
            }
            const owned = await ownedRes.json().catch(() => ([]));

            const cUrl = `${SUPABASE_URL}/rest/v1/writing_collaborators?user_id=eq.${encodeURIComponent(userId)}&select=project_id`;
            const cRes = await fetch(cUrl, { headers });
            if (!cRes.ok) {
                const errText = await cRes.text();
                res.status(500).json({ error: 'WRITING_LIST_PROJECTS_FAILED', message: errText || '获取协作项目失败' });
                return;
            }
            const cRows = await cRes.json().catch(() => ([]));
            const ids = Array.from(new Set((Array.isArray(cRows) ? cRows : []).map(r => r?.project_id).filter(Boolean))).filter(id => !owned.some(p => String(p?.id) === String(id)));

            let collabProjects = [];
            if (ids.length > 0) {
                const inExpr = `(${ids.join(',')})`;
                const listUrl = `${SUPABASE_URL}/rest/v1/writing_projects?id=in.${encodeURIComponent(inExpr)}&is_deleted=is.false&order=updated_at.desc&select=*`;
                const listRes = await fetch(listUrl, { headers });
                if (listRes.ok) {
                    collabProjects = await listRes.json().catch(() => ([]));
                }
            }

            res.status(200).json({ success: true, projects: [...owned, ...(Array.isArray(collabProjects) ? collabProjects : [])] });
            return;
        }

        if (action === 'writingGetProject') {
            const { projectId } = body || {};
            const access = await __requireProjectRole(projectId, 'viewer');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            res.status(200).json({ success: true, project: access.access.project, role: access.access.role });
            return;
        }

        if (action === 'writingUpdateProject') {
            const { projectId, patch } = body || {};
            const access = await __requireProjectRole(projectId, 'editor');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const safePatch = patch && typeof patch === 'object' ? patch : {};
            delete safePatch.owner_id;
            delete safePatch.created_at;
            delete safePatch.updated_at;
            const url = `${SUPABASE_URL}/rest/v1/writing_projects?id=eq.${encodeURIComponent(projectId)}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(safePatch)
            });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_UPDATE_PROJECT_FAILED', message: errText || '更新项目失败' });
                return;
            }
            const rows = await r.json().catch(() => ([]));
            res.status(200).json({ success: true, project: rows?.[0] || null });
            return;
        }

        if (action === 'writingDeleteProject') {
            const { projectId } = body || {};
            const access = await __requireProjectRole(projectId, 'owner');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const url = `${SUPABASE_URL}/rest/v1/writing_projects?id=eq.${encodeURIComponent(projectId)}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ is_deleted: true })
            });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_DELETE_PROJECT_FAILED', message: errText || '删除项目失败' });
                return;
            }
            res.status(200).json({ success: true });
            return;
        }

        if (action === 'writingListChapters') {
            const { projectId } = body || {};
            const access = await __requireProjectRole(projectId, 'viewer');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const url = `${SUPABASE_URL}/rest/v1/writing_chapters?project_id=eq.${encodeURIComponent(projectId)}&is_deleted=is.false&order=order_index.asc&select=*`;
            const r = await fetch(url, { headers });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_LIST_CHAPTERS_FAILED', message: errText || '获取章节失败' });
                return;
            }
            const rows = await r.json().catch(() => ([]));
            res.status(200).json({ success: true, chapters: rows });
            return;
        }

        if (action === 'writingCreateChapter') {
            const { projectId, title = '', content = '', orderIndex } = body || {};
            const access = await __requireProjectRole(projectId, 'editor');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }

            let finalOrderIndex = Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : null;
            if (finalOrderIndex === null) {
                try {
                    const maxUrl = `${SUPABASE_URL}/rest/v1/writing_chapters?project_id=eq.${encodeURIComponent(projectId)}&is_deleted=is.false&select=order_index&order=order_index.desc&limit=1`;
                    const mr = await fetch(maxUrl, { headers });
                    if (mr.ok) {
                        const mRows = await mr.json().catch(() => ([]));
                        finalOrderIndex = (mRows?.[0]?.order_index ?? -1) + 1;
                    } else {
                        finalOrderIndex = 0;
                    }
                } catch (e) {
                    finalOrderIndex = 0;
                }
            }

            const insertUrl = `${SUPABASE_URL}/rest/v1/writing_chapters`;
            const insertHeaders = { ...headers, Prefer: 'return=representation' };
            const payload = {
                project_id: projectId,
                order_index: finalOrderIndex,
                title: String(title || ''),
                content: String(content || ''),
                version: 1,
                last_editor: userId
            };
            const insRes = await fetch(insertUrl, {
                method: 'POST',
                headers: insertHeaders,
                body: JSON.stringify(payload)
            });
            if (!insRes.ok) {
                const errText = await insRes.text();
                res.status(500).json({ error: 'WRITING_CREATE_CHAPTER_FAILED', message: errText || '创建章节失败' });
                return;
            }
            const rows = await insRes.json().catch(() => ([]));
            res.status(200).json({ success: true, chapter: rows?.[0] || null });
            return;
        }

        if (action === 'writingGetChapter') {
            const { chapterId } = body || {};
            const ch = await __getChapterById(chapterId);
            if (!ch) {
                res.status(404).json({ error: 'WRITING_CHAPTER_NOT_FOUND' });
                return;
            }
            const access = await __requireProjectRole(ch.project_id, 'viewer');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            res.status(200).json({ success: true, chapter: ch });
            return;
        }

        if (action === 'writingUpdateChapter') {
            const { chapterId, patch, expectedVersion, createSnapshot = true } = body || {};
            const ch = await __getChapterById(chapterId);
            if (!ch) {
                res.status(404).json({ error: 'WRITING_CHAPTER_NOT_FOUND' });
                return;
            }
            const access = await __requireProjectRole(ch.project_id, 'editor');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const exp = Number(expectedVersion);
            if (!Number.isFinite(exp)) {
                res.status(400).json({ error: 'MISSING_EXPECTED_VERSION' });
                return;
            }

            const safePatch = patch && typeof patch === 'object' ? { ...patch } : {};
            delete safePatch.project_id;
            delete safePatch.version;
            delete safePatch.created_at;
            delete safePatch.updated_at;
            delete safePatch.last_editor;
            delete safePatch.is_deleted;

            const nextVersion = exp + 1;
            const patchBody = { ...safePatch, version: nextVersion, last_editor: userId };
            const url = `${SUPABASE_URL}/rest/v1/writing_chapters?id=eq.${encodeURIComponent(ch.id)}&version=eq.${encodeURIComponent(String(exp))}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(patchBody)
            });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_UPDATE_CHAPTER_FAILED', message: errText || '更新章节失败' });
                return;
            }
            const rows = await r.json().catch(() => ([]));
            const updated = rows?.[0] || null;
            if (!updated) {
                const latest = await __getChapterById(ch.id);
                res.status(409).json({
                    error: 'WRITING_CONFLICT',
                    message: '版本冲突，请刷新后再提交',
                    currentVersion: latest?.version,
                    currentContent: latest?.content,
                    currentTitle: latest?.title
                });
                return;
            }

            if (createSnapshot) {
                try {
                    const sUrl = `${SUPABASE_URL}/rest/v1/writing_snapshots`;
                    await fetch(sUrl, {
                        method: 'POST',
                        headers: { ...headers, Prefer: 'return=minimal' },
                        body: JSON.stringify({ chapter_id: ch.id, version: exp, content: String(ch.content || ''), created_by: userId })
                    });
                } catch (e) {
                }
            }

            res.status(200).json({ success: true, chapter: updated });
            return;
        }

        if (action === 'writingDeleteChapter') {
            const { chapterId } = body || {};
            const ch = await __getChapterById(chapterId);
            if (!ch) {
                res.status(404).json({ error: 'WRITING_CHAPTER_NOT_FOUND' });
                return;
            }
            const access = await __requireProjectRole(ch.project_id, 'editor');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const url = `${SUPABASE_URL}/rest/v1/writing_chapters?id=eq.${encodeURIComponent(ch.id)}`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ is_deleted: true, last_editor: userId, version: (Number(ch.version) || 1) + 1 })
            });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_DELETE_CHAPTER_FAILED', message: errText || '删除章节失败' });
                return;
            }
            res.status(200).json({ success: true });
            return;
        }

        if (action === 'writingCreateInvite') {
            const { projectId, role = 'editor' } = body || {};
            const access = await __requireProjectRole(projectId, 'editor');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const token = crypto.randomBytes(24).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const payload = {
                token,
                project_id: projectId,
                role: String(role || 'editor'),
                created_by: userId,
                expires_at: expiresAt
            };
            const url = `${SUPABASE_URL}/rest/v1/writing_invite_tokens`;
            const r = await fetch(url, {
                method: 'POST',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(payload)
            });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_CREATE_INVITE_FAILED', message: errText || '创建邀请失败' });
                return;
            }
            const rows = await r.json().catch(() => ([]));
            res.status(200).json({ success: true, invite: rows?.[0] || null });
            return;
        }

        if (action === 'writingAcceptInvite') {
            const { token } = body || {};
            const t = String(token || '').trim();
            if (!t) {
                res.status(400).json({ error: 'MISSING_TOKEN' });
                return;
            }
            const url = `${SUPABASE_URL}/rest/v1/writing_invite_tokens?token=eq.${encodeURIComponent(t)}&select=*`;
            const r = await fetch(url, { headers });
            if (!r.ok) {
                const errText = await r.text();
                res.status(500).json({ error: 'WRITING_ACCEPT_INVITE_FAILED', message: errText || '读取邀请失败' });
                return;
            }
            const rows = await r.json().catch(() => ([]));
            const invite = rows?.[0] || null;
            if (!invite) {
                res.status(404).json({ error: 'WRITING_INVITE_NOT_FOUND' });
                return;
            }
            if (invite.used_by) {
                res.status(400).json({ error: 'WRITING_INVITE_USED' });
                return;
            }
            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                res.status(400).json({ error: 'WRITING_INVITE_EXPIRED' });
                return;
            }

            try {
                const cUrl = `${SUPABASE_URL}/rest/v1/writing_collaborators`;
                await fetch(cUrl, {
                    method: 'POST',
                    headers: { ...headers, Prefer: 'return=minimal' },
                    body: JSON.stringify({ project_id: invite.project_id, user_id: userId, role: invite.role || 'editor', invited_by: invite.created_by || null })
                });
            } catch (e) {
            }

            const pUrl = `${SUPABASE_URL}/rest/v1/writing_invite_tokens?token=eq.${encodeURIComponent(t)}&used_by=is.null`;
            const pr = await fetch(pUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ used_by: userId, used_at: new Date().toISOString() })
            });
            if (!pr.ok) {
                const errText = await pr.text();
                res.status(500).json({ error: 'WRITING_ACCEPT_INVITE_FAILED', message: errText || '更新邀请状态失败' });
                return;
            }

            const access = await __requireProjectRole(invite.project_id, 'viewer');
            res.status(200).json({ success: true, project: access.ok ? access.access.project : null, role: access.ok ? access.access.role : null });
            return;
        }

        if (action === 'writingExport') {
            const { projectId, format = 'md' } = body || {};
            const access = await __requireProjectRole(projectId, 'viewer');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const project = access.access.project;
            const chaptersUrl = `${SUPABASE_URL}/rest/v1/writing_chapters?project_id=eq.${encodeURIComponent(projectId)}&is_deleted=is.false&order=order_index.asc&select=title,content,order_index`;
            const cr = await fetch(chaptersUrl, { headers });
            if (!cr.ok) {
                const errText = await cr.text();
                res.status(500).json({ error: 'WRITING_EXPORT_FAILED', message: errText || '获取章节失败' });
                return;
            }
            const chapters = await cr.json().catch(() => ([]));
            const fmt = String(format || 'md').toLowerCase();

            if (fmt === 'txt') {
                const out = [String(project?.title || '')].concat(
                    (Array.isArray(chapters) ? chapters : []).flatMap(ch => {
                        const t = String(ch?.title || '').trim();
                        const c = String(ch?.content || '');
                        const lines = [];
                        if (t) lines.push(t);
                        if (c) lines.push(c);
                        lines.push('');
                        return lines;
                    })
                ).join('\n');
                res.status(200).json({ success: true, format: 'txt', content: out });
                return;
            }

            const out = [`# ${String(project?.title || '').trim()}`].concat(
                (Array.isArray(chapters) ? chapters : []).map((ch, idx) => {
                    const t = String(ch?.title || '').trim() || `Chapter ${idx + 1}`;
                    const c = String(ch?.content || '');
                    return `\n## ${t}\n\n${c}`;
                })
            ).join('\n');
            res.status(200).json({ success: true, format: 'md', content: out });
            return;
        }

        if (action === 'writingExportUpload') {
            const { projectId, format = 'md', filepath = '' } = body || {};
            const access = await __requireProjectRole(projectId, 'viewer');
            if (!access.ok) {
                res.status(403).json({ error: 'WRITING_FORBIDDEN' });
                return;
            }
            const project = access.access.project;
            const chaptersUrl = `${SUPABASE_URL}/rest/v1/writing_chapters?project_id=eq.${encodeURIComponent(projectId)}&is_deleted=is.false&order=order_index.asc&select=title,content,order_index`;
            const cr = await fetch(chaptersUrl, { headers });
            if (!cr.ok) {
                const errText = await cr.text();
                res.status(500).json({ error: 'WRITING_EXPORT_FAILED', message: errText || '获取章节失败' });
                return;
            }
            const chapters = await cr.json().catch(() => ([]));
            const fmt = String(format || 'md').toLowerCase();

            let content = '';
            if (fmt === 'txt') {
                content = [String(project?.title || '')].concat(
                    (Array.isArray(chapters) ? chapters : []).flatMap((ch, idx) => {
                        const t = String(ch?.title || '').trim() || `Chapter ${idx + 1}`;
                        const c = String(ch?.content || '');
                        const lines = [];
                        if (t) lines.push(t);
                        if (c) lines.push(c);
                        lines.push('');
                        return lines;
                    })
                ).join('\n');
            } else {
                content = [`# ${String(project?.title || '').trim()}`].concat(
                    (Array.isArray(chapters) ? chapters : []).map((ch, idx) => {
                        const t = String(ch?.title || '').trim() || `Chapter ${idx + 1}`;
                        const c = String(ch?.content || '');
                        return `\n## ${t}\n\n${c}`;
                    })
                ).join('\n');
            }

            const bucket = String(process.env.WRITING_EXPORT_BUCKET || 'writing-exports').trim() || 'writing-exports';
            const ext = (fmt === 'txt') ? 'txt' : 'md';
            const safeProjectTitle = String(project?.title || 'novel').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
            const rawPath = String(filepath || '').trim();
            const objectPath = rawPath
                ? rawPath.replace(/^\/+/, '')
                : `exports/${encodeURIComponent(String(projectId))}/${Date.now()}_${safeProjectTitle}.${ext}`;

            const objectPathEncoded = encodeURIComponent(objectPath).replace(/%2F/g, '/');
            const objectUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPathEncoded}`;
            const upRes = await fetch(objectUrl, {
                method: 'PUT',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': (fmt === 'txt') ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8',
                    'x-upsert': 'true'
                },
                body: Buffer.from(String(content || ''), 'utf-8')
            });
            if (!upRes.ok) {
                const errText = await upRes.text();
                res.status(500).json({
                    error: 'WRITING_EXPORT_UPLOAD_FAILED',
                    message: errText || '上传失败（请确认已创建 Storage bucket）',
                    bucket
                });
                return;
            }

            const expiresIn = 7 * 24 * 60 * 60;
            const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objectPathEncoded}`;
            const sr = await fetch(signUrl, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expiresIn })
            });
            if (!sr.ok) {
                const errText = await sr.text();
                res.status(500).json({ error: 'WRITING_EXPORT_SIGN_FAILED', message: errText || '生成下载链接失败' });
                return;
            }
            const signed = await sr.json().catch(() => ({}));
            const signedURL = signed?.signedURL || signed?.signedUrl || signed?.signed_url || '';
            const fullUrl = signedURL && String(signedURL).startsWith('http') ? signedURL : (signedURL ? `${SUPABASE_URL}${signedURL}` : '');

            res.status(200).json({
                success: true,
                bucket,
                path: objectPath,
                format: fmt === 'txt' ? 'txt' : 'md',
                expiresIn,
                signedUrl: fullUrl
            });
            return;
        }

        // ========== 用户长期记忆 ==========
        if (action === 'saveUserMemory') {
            const { data } = body || {};
            if (!data || typeof data !== 'object') {
                res.status(400).json({ error: 'INVALID_DATA', message: '缺少有效的 data 对象' });
                return;
            }
            try {
                // Upsert: if user_id row exists, update; otherwise insert
                const upsertUrl = `${SUPABASE_URL}/rest/v1/user_memory`;
                const upsertHeaders = {
                    ...headers,
                    Prefer: 'return=representation,resolution=merge-duplicates'
                };
                const payload = {
                    user_id: userId,
                    data: data,
                    updated_at: new Date().toISOString()
                };
                const uRes = await fetch(upsertUrl, {
                    method: 'POST',
                    headers: upsertHeaders,
                    body: JSON.stringify(payload)
                });
                if (!uRes.ok) {
                    const errText = await uRes.text();
                    console.error('[supabase-proxy] saveUserMemory failed:', uRes.status, errText);
                    res.status(500).json({ error: 'SAVE_MEMORY_FAILED', message: errText || '保存用户记忆失败' });
                    return;
                }
                const rows = await uRes.json().catch(() => ([]));
                console.log(`[supabase-proxy] 🧠 用户记忆已保存: ${userId}`);
                res.status(200).json({ success: true, memory: rows?.[0] || null });
                return;
            } catch (e) {
                console.error('[supabase-proxy] saveUserMemory error:', e.message);
                res.status(500).json({ error: 'SAVE_MEMORY_ERROR', message: e.message });
                return;
            }
        }

        if (action === 'getUserMemory') {
            try {
                const getUrl = `${SUPABASE_URL}/rest/v1/user_memory?user_id=eq.${encodeURIComponent(userId)}&select=*`;
                const gRes = await fetch(getUrl, { headers });
                if (!gRes.ok) {
                    const errText = await gRes.text();
                    console.error('[supabase-proxy] getUserMemory failed:', gRes.status, errText);
                    res.status(500).json({ error: 'GET_MEMORY_FAILED', message: errText || '获取用户记忆失败' });
                    return;
                }
                const rows = await gRes.json().catch(() => ([]));
                const memory = rows?.[0] || null;
                res.status(200).json({ success: true, memory });
                return;
            } catch (e) {
                console.error('[supabase-proxy] getUserMemory error:', e.message);
                res.status(500).json({ error: 'GET_MEMORY_ERROR', message: e.message });
                return;
            }
        }

        // ========== 查询生成记录 ==========
        if (action === 'queryGenerationRecords') {
            const { recordType, limit = 10 } = body || {};
            const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
            const filters = [`user_id=eq.${encodeURIComponent(userId)}`];
            if (recordType) filters.push(`record_type=eq.${encodeURIComponent(String(recordType))}`);
            try {
                const queryUrl = `${SUPABASE_URL}/rest/v1/generation_records?${filters.join('&')}&select=*&order=created_at.desc&limit=${safeLimit}`;
                const queryRes = await fetch(queryUrl, { headers });
                if (!queryRes.ok) {
                    const errText = await queryRes.text();
                    console.error('[supabase-proxy] 查询生成记录失败:', queryRes.status, errText);
                    res.status(500).json({ success: false, error: 'QUERY_RECORDS_FAILED', message: errText || '查询生成记录失败' });
                    return;
                }
                const records = await queryRes.json().catch(() => []);
                res.status(200).json({ success: true, records: Array.isArray(records) ? records : [] });
                return;
            } catch (e) {
                console.error('[supabase-proxy] 查询生成记录异常:', e.message);
                res.status(500).json({ success: false, error: 'QUERY_RECORDS_ERROR', message: e.message });
                return;
            }
        }

        // ========== 保存生成记录 ==========
        if (action === 'saveGenerationRecord') {
            const { recordType, contentUrl, contentText, prompt, model, cost, metadata } = body;
            
            if (!recordType) {
                res.status(400).json({ error: 'MISSING_RECORD_TYPE', message: '缺少记录类型' });
                return;
            }
            
            try {
                const insertUrl = `${SUPABASE_URL}/rest/v1/generation_records`;
                const insertHeaders = { ...headers, Prefer: 'return=representation' };
                
                const recordData = {
                    user_id: userId,
                    record_type: recordType,
                    content_url: contentUrl || null,
                    content_text: contentText || null,
                    prompt: prompt || null,
                    model: model || null,
                    cost: Math.ceil(cost || 0),
                    metadata: metadata || null
                };
                
                const insertRes = await fetch(insertUrl, {
                    method: 'POST',
                    headers: insertHeaders,
                    body: JSON.stringify(recordData)
                });
                
                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    console.error('[supabase-proxy] 保存生成记录失败:', insertRes.status, errText);
                    // 不阻塞主流程，只记录警告
                    res.status(200).json({ success: false, error: 'INSERT_FAILED', message: errText });
                    return;
                }
                
                const insertedRows = await insertRes.json().catch(() => []);
                const recordId = insertedRows?.[0]?.id;
                
                console.log(`[supabase-proxy] 📝 生成记录已保存: ${recordId}`);
                res.status(200).json({ success: true, recordId });
                return;
            } catch (e) {
                console.error('[supabase-proxy] 保存生成记录异常:', e.message);
                res.status(200).json({ success: false, error: 'SAVE_ERROR', message: e.message });
                return;
            }
        }

        // ========== 胶片充值/消费 ==========
        let newBalance = currentBalance;
        let newUsed = currentUsed;
        // 支持 recharge/addQuota 作为充值，consume 作为消费
        // 🔧 修复：统一使用 quota_balance，禁用 film_lots 系统防止余额暴增
        // 问题：退款时创建新lot但不更新quota_balance，导致totalBalance=lots+quota_balance持续增长
        // 解决：所有充值/退款都直接更新 quota_balance
        if (action === 'recharge' || action === 'addQuota') {
            // 🔧 统一更新 quota_balance，不使用 lots 系统
            newBalance = __round2(currentBalance + amount);
            console.log(`[supabase-proxy] ${action} 更新quota_balance: ${currentBalance} -> ${newBalance}`);
        } else if (action === 'consume') {
            // 🔧 统一从 quota_balance 扣费，不使用 lots 系统
            if (currentBalance < amount) {
                res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: '余额不足', quotaBalance: currentBalance, quotaUsed: currentUsed });
                return;
            }
            newBalance = __round2(currentBalance - amount);
            newUsed = __round2(currentUsed + amount);
            console.log(`[supabase-proxy] consume 扣费: ${currentBalance} -> ${newBalance}, 已用: ${currentUsed} -> ${newUsed}`);
        // ========== 内容审核功能 ==========
        } else if (action === 'checkPrompt') {
            // 检查提示词是否违规
            const content = String(body?.content || '').toLowerCase();
            if (!content) {
                res.status(200).json({ safe: true, level: 0 });
                return;
            }

            // 违规词库（分级）
            const VIOLATION_KEYWORDS = {
                extreme: ['习近平', '毛泽东', '邓小平', '江泽民', '胡锦涛', '共产党', '法轮功', '六四', '天安门', '台独', '藏独', '港独', '颠覆政权', '恐怖袭击', '炸弹制作', 'ISIS', '纳粹', '希特勒', '种族灭绝'],
                severe: ['裸体', '性交', 'sex', 'nude', 'porn', '色情', 'nsfw', '强奸', '性侵', '血腥', '肢解', '虐杀', '自杀方法', '毒品', '冰毒', '海洛因', '儿童色情', 'loli'],
                warning: ['傻逼', '操你', '草泥马', '他妈的', '婊子', '黑鬼', '支那']
            };

            let maxLevel = 0;
            let category = '';

            for (const kw of VIOLATION_KEYWORDS.extreme) {
                if (content.includes(kw.toLowerCase())) { maxLevel = 3; category = 'extreme'; break; }
            }
            if (maxLevel < 3) {
                for (const kw of VIOLATION_KEYWORDS.severe) {
                    if (content.includes(kw.toLowerCase())) { maxLevel = 2; category = 'severe'; break; }
                }
            }
            if (maxLevel < 2) {
                for (const kw of VIOLATION_KEYWORDS.warning) {
                    if (content.includes(kw.toLowerCase())) { maxLevel = 1; category = 'warning'; break; }
                }
            }

            const messages = {
                3: '⛔ 检测到极端违规内容，已记录并禁止生成。',
                2: '🚫 检测到违规内容，禁止生成。请修改提示词后重试。',
                1: '⚠️ 检测到敏感内容，建议修改。',
                0: ''
            };

            res.status(200).json({
                safe: maxLevel === 0,
                level: maxLevel,
                category,
                message: messages[maxLevel]
            });
            return;

        } else if (action === 'checkUserBan') {
            // 检查用户是否被封禁
            const banUrl = `${SUPABASE_URL}/rest/v1/user_bans?user_id=eq.${userId}&is_active=eq.true&select=*&limit=1`;
            const banRes = await fetch(banUrl, { headers });
            if (banRes.ok) {
                const bans = await banRes.json().catch(() => []);
                const ban = bans?.[0];
                if (ban) {
                    // 检查是否过期
                    if (ban.expires_at && new Date(ban.expires_at) < new Date()) {
                        // 自动解封
                        await fetch(`${SUPABASE_URL}/rest/v1/user_bans?id=eq.${ban.id}`, {
                            method: 'PATCH', headers, body: JSON.stringify({ is_active: false })
                        });
                        res.status(200).json({ banned: false });
                        return;
                    }
                    res.status(200).json({
                        banned: true,
                        reason: ban.reason,
                        expiresAt: ban.expires_at,
                        permanent: !ban.expires_at
                    });
                    return;
                }
            }
            res.status(200).json({ banned: false });
            return;

        } else {
            res.status(400).json({ error: 'INVALID_ACTION', message: '无效操作' });
            return;
        }

        console.log(`[supabase-proxy] 余额变更: ${currentBalance} → ${newBalance}`);

        // 2. 更新余额和已用额度
        // 🔧 修复：只有在需要更新 quota_balance 或 quota_used 时才发送 PATCH 请求
        const needUpdateQuotaBalance = newBalance !== currentBalance;
        const needUpdateQuotaUsed = action === 'consume' && newUsed !== currentUsed;
        
        if (needUpdateQuotaBalance || needUpdateQuotaUsed) {
            const updateUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
            const updateData = {};
            
            if (needUpdateQuotaBalance) {
                updateData.quota_balance = newBalance;
            }
            if (needUpdateQuotaUsed) {
                updateData.quota_used = newUsed;
            }
            
            console.log('[supabase-proxy] 更新数据:', JSON.stringify(updateData));
            
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(updateData)
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                console.error('[supabase-proxy] 更新余额失败:', updateRes.status, errText);
                res.status(500).json({ error: 'UPDATE_FAILED', message: `更新失败: ${updateRes.status}`, detail: errText });
                return;
            }
        } else {
            console.log('[supabase-proxy] 无需更新 user_profiles（quota_balance 和 quota_used 均未变化）');
        }

        // 3. 记录日志（可选，失败不影响主流程）
        try {
            const logUrl = `${SUPABASE_URL}/rest/v1/quota_logs`;
            await fetch(logUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    user_id: userId,
                    action_type: (action === 'addQuota' ? 'recharge' : action),
                    amount: action === 'recharge' ? amount : -amount,
                    balance_after: newBalance,
                    description: description || (action === 'recharge' ? '充值' : '消费')
                })
            });
        } catch (logErr) {
            console.warn('[supabase-proxy] 日志记录失败:', logErr.message);
        }

        console.log(`[supabase-proxy] ✅ ${action} 成功: ${amount} → 新余额: ${newBalance}`);

        // 🔧 修复：直接返回 quota_balance，不使用 lots 系统
        res.status(200).json({
            success: true,
            newBalance: newBalance,
            quotaBalance: newBalance,
            newUsed,
            membershipType: currentMembershipType,
            message: action === 'recharge' ? '充值成功' : '消费成功'
        });

    } catch (error) {
        console.error('[supabase-proxy] 错误:', error);
        res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
    }
};
