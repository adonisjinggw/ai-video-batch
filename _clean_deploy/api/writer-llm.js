// MIMO API（主通道，您已配置）
const WRITER_MIMO_API_KEY = process.env.WRITER_MIMO_API_KEY || process.env.WRITER_LLM_API_KEY || '';
const WRITER_MIMO_BASE_URL = (process.env.WRITER_MIMO_BASE_URL || process.env.WRITER_LLM_BASE_URL || 'https://api.xiaomimimo.com').replace(/\/$/, '');
const WRITER_MIMO_MODEL = process.env.WRITER_MIMO_MODEL || process.env.WRITER_LLM_MODEL || '';

// 云雾API（备用，仅在明确配置模型时启用）
const YUNMENG_API_KEY = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
const YUNMENG_BASE_URL = (process.env.YUNMENG_BASE_URL || 'https://yunwu.ai/v1').replace(/\/$/, '');
const YUNMENG_MODEL = process.env.YUNMENG_MODEL || process.env.YUNWU_MODEL || 'qwen-plus';

// 🚀 云雾多端点配置（与 banana2.js 一致）
const YUNMENG_ENDPOINTS = [
    'https://api3.wlai.vip',
    'https://yunwu.zeabur.app',
    'https://yunwu.ai'
];

// 魔塔API（可选，仅在设置 KEY 且前端显式请求时使用）
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1';
const MODELSCOPE_WRITER_MODEL = process.env.MODELSCOPE_WRITER_MODEL || 'Qwen/Qwen3-Coder-480B-A35B-Instruct';

// ========== Supabase 配置（用于会员验证） ==========
const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ========== 计费配置 ==========
// 🎯 按实际 token 计费：每 1000 token = 1 胶片（最低 1 胶片）
const FILM_PER_1K_TOKENS = 1;

/**
 * 根据 API 返回的 usage 计算实际胶片消耗
 * @param {object} usage - API 返回的 { prompt_tokens, completion_tokens, total_tokens }
 * @returns {number} 应扣胶片数
 */
function calculateTokenCost(usage) {
    const totalTokens = usage?.total_tokens || ((usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0));
    if (totalTokens <= 0) return 1; // 最低 1 胶片
    return Math.max(1, Math.ceil(totalTokens / 1000 * FILM_PER_1K_TOKENS));
}

/**
 * 🔐 检查用户是否为付费会员
 * @param {string} userId
 * @returns {Promise<{isPaid: boolean, membershipType: string, message: string}>}
 */
async function checkPaidMembership(userId) {
    if (!SUPABASE_SERVICE_KEY) {
        console.warn('[writer-llm] 未配置 SUPABASE_SERVICE_KEY，跳过会员验证');
        return { isPaid: true, membershipType: 'unknown', message: '' };
    }
    try {
        const url = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=membership_type,membership_level,membership_expires_at`;
        const resp = await fetch(url, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (!resp.ok) {
            console.warn('[writer-llm] 查询会员状态失败:', resp.status);
            return { isPaid: false, membershipType: 'free', message: '会员状态查询失败，请稍后重试' };
        }
        const rows = await resp.json().catch(() => []);
        const profile = rows?.[0];
        if (!profile) {
            return { isPaid: false, membershipType: 'free', message: '用户不存在' };
        }
        const mt = (profile.membership_type || 'free').toLowerCase();
        const ml = Number(profile.membership_level) || 0;
        // 检查会员是否过期
        if (profile.membership_expires_at) {
            const expiresAt = new Date(profile.membership_expires_at);
            if (expiresAt < new Date()) {
                return { isPaid: false, membershipType: 'free', message: '会员已过期，请续费后使用写作功能' };
            }
        }
        // free 用户 且 level=0 → 非付费
        if (mt === 'free' && ml <= 0) {
            return { isPaid: false, membershipType: 'free', message: '写作功能为付费会员专享，请升级会员后使用' };
        }
        return { isPaid: true, membershipType: mt, level: ml, message: '' };
    } catch (e) {
        console.error('[writer-llm] 会员验证异常:', e.message);
        return { isPaid: false, membershipType: 'free', message: '会员验证失败，请稍后重试' };
    }
}

/**
 * 📝 保存生成记录 - 确保用户能找回已生成的内容
 */
async function __saveGenerationRecord(userId, recordType, contentUrl, prompt, model, cost, metadata) {
    if (!userId) return { success: false, error: 'no userId' };

    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://www.rollroll.art';

        const res = await fetch(`${baseUrl}/api/supabase-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveGenerationRecord',
                userId,
                recordType,
                contentUrl,
                prompt,
                model,
                cost,
                metadata
            })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            console.warn('[writer-llm] 保存记录失败:', data.error || data.message);
            return { success: false, error: data.error || data.message };
        }

        console.log(`[writer-llm] 📝 生成记录已保存: ${data.recordId}`);
        return { success: true, recordId: data.recordId };
    } catch (e) {
        console.warn('[writer-llm] 保存记录异常:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * 🔐 统一计费函数 - 调用 /api/supabase-proxy
 */
async function __billing(billingAction, userId, amount, description) {
    if (!userId || amount <= 0) return { success: true, skipped: true };

    const intAmount = Math.ceil(amount);
    const proxyAction = billingAction === 'refund' ? 'recharge' : 'consume';

    try {
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://www.rollroll.art';

        const res = await fetch(`${baseUrl}/api/supabase-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: proxyAction,
                userId,
                amount: intAmount,
                description: description || (billingAction === 'refund' ? '退款' : '消费')
            })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            if (billingAction === 'consume') {
                throw new Error(data.message || data.error || '扣费失败');
            }
            console.error(`[writer-llm] 退款失败:`, data);
            return { success: false, error: data.message || data.error };
        }

        console.log(`[writer-llm] 💰 ${billingAction === 'refund' ? '退款' : '扣费'}成功: ${userId} ${billingAction === 'refund' ? '+' : '-'}${intAmount}胶片`);
        return { success: true, newBalance: data.newBalance, newUsed: data.newUsed };
    } catch (e) {
        if (billingAction === 'consume') {
            throw e;
        }
        console.error(`[writer-llm] 退款异常:`, e.message);
        return { success: false, error: e.message };
    }
}

module.exports = async function handler(req, res) {
    const json = (status, payload) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        json(204, {});
        return;
    }

    if (req.method !== 'POST') {
        json(405, { error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const {
            model,
            messages,
            prompt,
            userId,  // 🔐 用户ID（计费用）
            temperature = 0.7,
            top_p = 0.95,
            max_completion_tokens = 2048,
            stream = false,
            stop = null,
            frequency_penalty = 0,
            presence_penalty = 0,
            thinking
        } = body || {};
        const skipBilling = body?.skip_billing === true;

        const reqModel = String(model || '').trim();
        const modelLc = reqModel.toLowerCase();

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫖）
        if (!userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
        }

        // 🔐 付费会员验证：写作功能仅付费会员可用
        if (!skipBilling) {
            const memberCheck = await checkPaidMembership(userId);
            if (!memberCheck.isPaid) {
                console.log(`[writer-llm] 🚫 非付费用户被拒: ${userId}, type=${memberCheck.membershipType}`);
                json(403, { error: 'MEMBERSHIP_REQUIRED', message: memberCheck.message || '写作功能为付费会员专享，请升级会员后使用' });
                return;
            }
            console.log(`[writer-llm] ✅ 会员验证通过: ${userId}, type=${memberCheck.membershipType}, level=${memberCheck.level}`);
        }

        // 检查是否有可用的API Key（MIMO 或 云雾+模型 或 MODELSCOPE 任意其一）
        const hasMimo = !!WRITER_MIMO_API_KEY;
        const hasYunmeng = !!(YUNMENG_API_KEY && YUNMENG_MODEL);
        const hasModelscope = !!MODELSCOPE_API_KEY;
        if (!hasMimo && !hasYunmeng && !hasModelscope) {
            json(500, { error: 'WRITER_LLM_NOT_CONFIGURED', message: 'missing MIMO or YUNMENG (with model) or MODELSCOPE API configuration' });
            return;
        }

        const finalMessages = Array.isArray(messages) && messages.length
            ? messages
            : [{ role: 'user', content: String(prompt || '').trim() }];

        if (!finalMessages[0]?.content) {
            json(400, { error: 'MISSING_PROMPT' });
            return;
        }

        // 💰 按实际 token 后计费（API 调用成功后根据 usage 扣费）
        let filmCost = 0;
        let billingSuccess = false;

        // 优先顺序：可选魔塔(仅显式请求) → MIMO → 云雾(需明确模型)
        let response, data, content;

        // 0) 可选：前端显式请求 roll 或包含 qwen3-coder-480b 时，优先尝试魔塔
        const useModelScope = modelLc === 'roll' || modelLc.includes('qwen3-coder-480b');
        if (useModelScope && MODELSCOPE_API_KEY) {
            try {
                const payload = {
                    model: MODELSCOPE_WRITER_MODEL,
                    messages: finalMessages,
                    max_tokens: max_completion_tokens,
                    temperature,
                    top_p,
                    stream: false
                };

                const url = `${MODELSCOPE_BASE_URL}/chat/completions`;
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${MODELSCOPE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(180000)
                });

                if (response.ok) {
                    data = await response.json();
                    content = data?.choices?.[0]?.message?.content;
                    // 💰 后计费：按实际 token 扣费
                    const usage = data?.usage;
                    filmCost = calculateTokenCost(usage);
                    if (!skipBilling && filmCost > 0) {
                        const br = await __billing('consume', userId, filmCost, `写作助手(魔塔,${usage?.total_tokens || 0}tokens)`);
                        billingSuccess = br.success && !br.skipped;
                    }
                    console.log(`[writer-llm] 💰 实际计费: ${usage?.total_tokens || 0}tokens → ${filmCost}胶片`);
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', 'roll', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: filmCost, model: 'roll', tokens: usage?.total_tokens || 0 });
                    return;
                }
                console.warn('[writer-llm] 魔塔API失败:', response.status);
            } catch (e) {
                console.warn('[writer-llm] 魔塔API异常:', e.message);
            }
        }

        // 1) 检查是否显式选择 MIMO
        const preferMimo = (modelLc === 'mimo' || modelLc.startsWith('mimo:') || modelLc.startsWith('mimo-') || modelLc.includes('mimo'));

        // 2) 检查是否显式选择云雾（包括 grok-4-fast）
        const preferYunwu = (modelLc === 'yunwu' || modelLc === 'yunmeng' || modelLc.startsWith('yunwu:') || modelLc === 'qwen-plus' || modelLc.startsWith('qwen-') || modelLc.startsWith('grok-'));

        // 1b) MIMO（主通道）
        if ((preferMimo || (!preferYunwu)) && WRITER_MIMO_API_KEY) {
            try {
                let mimoModel = reqModel;
                if (modelLc === 'mimo') mimoModel = WRITER_MIMO_MODEL || 'mimo-v2-flash';
                if (modelLc.startsWith('mimo:')) mimoModel = reqModel.split(':').slice(1).join(':') || (WRITER_MIMO_MODEL || 'mimo-v2-flash');
                if (!mimoModel || mimoModel.toLowerCase() === 'mimo') mimoModel = WRITER_MIMO_MODEL || 'mimo-v2-flash';
                const payload = {
                    model: String(mimoModel),
                    messages: finalMessages,
                    max_completion_tokens,
                    temperature,
                    top_p,
                    stream: !!stream,
                    stop,
                    frequency_penalty,
                    presence_penalty
                };
                if (thinking && typeof thinking === 'object') payload.thinking = thinking;

                const url = `${WRITER_MIMO_BASE_URL}/v1/chat/completions`;
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${WRITER_MIMO_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(120000)
                });

                if (response.ok) {
                    data = await response.json();
                    content = data?.choices?.[0]?.message?.content;
                    // 💰 后计费：按实际 token 扣费
                    const usage = data?.usage;
                    filmCost = calculateTokenCost(usage);
                    if (!skipBilling && filmCost > 0) {
                        const br = await __billing('consume', userId, filmCost, `写作助手(MIMO,${usage?.total_tokens || 0}tokens)`);
                        billingSuccess = br.success && !br.skipped;
                    }
                    console.log(`[writer-llm] 💰 实际计费: ${usage?.total_tokens || 0}tokens → ${filmCost}胶片`);
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', 'MIMO', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: filmCost, tokens: usage?.total_tokens || 0 });
                    return;
                }
                console.warn('[writer-llm] MIMO API失败:', response.status);
            } catch (e) {
                console.warn('[writer-llm] MIMO API异常:', e.message);
            }
        }

        // 2b) 云雾（需配置模型，支持 grok-4-fast）- 🚀 多端点并行请求
        if ((preferYunwu || (!preferMimo)) && YUNMENG_API_KEY) {
            let yunwuModel = YUNMENG_MODEL || 'grok-4-fast';
            if (modelLc === 'qwen-plus' || modelLc.startsWith('qwen-')) yunwuModel = reqModel;
            if (modelLc.startsWith('grok-')) yunwuModel = reqModel;
            if (modelLc.startsWith('yunwu:')) yunwuModel = reqModel.split(':').slice(1).join(':') || 'grok-4-fast';
            const payload = {
                model: yunwuModel,
                messages: finalMessages,
                max_tokens: max_completion_tokens,
                temperature,
                top_p,
                stream: false
            };

            // 🚀 并行请求所有端点，任一成功立即返回
            console.log(`[writer-llm] 🚀 云雾并行请求 ${YUNMENG_ENDPOINTS.length} 个端点...`);

            const result = await new Promise((resolve) => {
                let settled = false;
                let failCount = 0;
                const totalRequests = YUNMENG_ENDPOINTS.length;
                const errors = [];

                YUNMENG_ENDPOINTS.forEach((endpoint, idx) => {
                    const url = `${endpoint}/v1/chat/completions`;

                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${YUNMENG_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(120000)
                    })
                        .then(res => {
                            if (settled) return;

                            if (res.ok) {
                                console.log(`[writer-llm] ✅ ${endpoint} 成功`);
                                settled = true;
                                resolve({ success: true, response: res, endpoint });
                            } else {
                                console.warn(`[writer-llm] ${endpoint} 返回 ${res.status}`);
                                errors.push({ endpoint, status: res.status });
                                failCount++;

                                if (failCount >= totalRequests && !settled) {
                                    settled = true;
                                    resolve({ success: false, errors });
                                }
                            }
                        })
                        .catch(err => {
                            if (settled) return;
                            console.warn(`[writer-llm] ${endpoint} 异常:`, err.message);
                            errors.push({ endpoint, error: err.message });
                            failCount++;

                            if (failCount >= totalRequests && !settled) {
                                settled = true;
                                resolve({ success: false, errors });
                            }
                        });
                });
            });

            if (result.success) {
                try {
                    data = await result.response.json();
                    content = data?.choices?.[0]?.message?.content;
                    // 💰 后计费：按实际 token 扣费
                    const usage = data?.usage;
                    filmCost = calculateTokenCost(usage);
                    if (!skipBilling && filmCost > 0) {
                        const br = await __billing('consume', userId, filmCost, `写作助手(云雾,${usage?.total_tokens || 0}tokens)`);
                        billingSuccess = br.success && !br.skipped;
                    }
                    console.log(`[writer-llm] 💰 实际计费: ${usage?.total_tokens || 0}tokens → ${filmCost}胶片`);
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', '云雾', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: filmCost, tokens: usage?.total_tokens || 0 });
                    return;
                } catch (parseErr) {
                    console.warn('[writer-llm] 解析响应失败:', parseErr.message);
                }
            }

            // 所有端点失败（后计费模式无需退款，因为还没扣）
            console.error('[writer-llm] 云雾所有端点均失败');
            const firstError = result.errors?.[0];
            json(500, { success: false, error: 'WRITER_LLM_FAILED', error_code: 'API_ERROR', status: firstError?.status || 500, message: '云雾所有节点均不可用', billed: 0 });
            return;
        }

        // 所有通道失败（后计费模式无需退款）
        json(500, { success: false, error: 'WRITER_LLM_FAILED', error_code: 'NO_API_AVAILABLE', message: '所有API通道均不可用', billed: 0 });
    } catch (error) {
        // 异常兜底（后计费模式，如果已扣费则退款）
        try {
            if (typeof billingSuccess !== 'undefined' && billingSuccess && filmCost > 0) {
                await __billing('refund', userId, filmCost, '写作助手异常退款');
            }
        } catch (e) { }
        json(500, { error: 'WRITER_LLM_FAILED', message: error?.message || String(error || '') });
    }
};
