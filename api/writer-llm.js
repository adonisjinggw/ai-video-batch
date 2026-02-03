// MIMO API（主通道，您已配置）
const WRITER_MIMO_API_KEY = process.env.WRITER_MIMO_API_KEY || process.env.WRITER_LLM_API_KEY || '';
const WRITER_MIMO_BASE_URL = (process.env.WRITER_MIMO_BASE_URL || process.env.WRITER_LLM_BASE_URL || 'https://api.xiaomimimo.com').replace(/\/$/, '');
const WRITER_MIMO_MODEL = process.env.WRITER_MIMO_MODEL || process.env.WRITER_LLM_MODEL || '';

// 云雾API（备用，仅在明确配置模型时启用）
const YUNMENG_API_KEY = process.env.YUNMENG_API_KEY || process.env.YUNWU_API_KEY || '';
const YUNMENG_BASE_URL = (process.env.YUNMENG_BASE_URL || 'https://yunwu.ai/v1').replace(/\/$/, '');
const YUNMENG_MODEL = process.env.YUNMENG_MODEL || process.env.YUNWU_MODEL || 'qwen-plus';

// 魔塔API（可选，仅在设置 KEY 且前端显式请求时使用）
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || '';
const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1';
const MODELSCOPE_WRITER_MODEL = process.env.MODELSCOPE_WRITER_MODEL || 'Qwen/Qwen3-Coder-480B-A35B-Instruct';

// ========== 计费配置 ==========
// 🎯 阶梯计费：按输入字符数计费，不封顶
// <2000字符=1胶片, 2000-5000=2胶片, 5000-8000=3胶片, 每增加3000字符+1胶片
function calculateFilmCost(messages) {
    // 计算所有消息的总字符数
    let totalChars = 0;
    if (Array.isArray(messages)) {
        for (const msg of messages) {
            if (msg && typeof msg.content === 'string') {
                totalChars += msg.content.length;
            }
        }
    }
    
    // 阶梯计费逻辑
    if (totalChars < 2000) {
        return { cost: 1, totalChars, tier: '基础' };
    } else if (totalChars < 5000) {
        return { cost: 2, totalChars, tier: '中等' };
    } else if (totalChars < 8000) {
        return { cost: 3, totalChars, tier: '较长' };
    } else {
        // 超过8000字符：3胶片 + 每额外3000字符加1胶片
        const extraChars = totalChars - 8000;
        const extraCost = Math.ceil(extraChars / 3000);
        return { cost: 3 + extraCost, totalChars, tier: '超长' };
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

        const reqModel = String(model || '').trim();
        const modelLc = reqModel.toLowerCase();

        // 🔐 安全检查：必须提供 userId 才能使用 API（防止白嫖）
        if (!userId) {
            json(401, { error: 'UNAUTHORIZED', message: '请先登录后再使用此功能' });
            return;
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

        // 💰 阶梯计费：按输入字符数计费
        const { cost: filmCost, totalChars, tier } = calculateFilmCost(finalMessages);
        console.log(`[writer-llm] 📊 阶梯计费: ${totalChars}字符 → ${filmCost}胶片 (${tier})`);
        let billingSuccess = false;

        // 🔒 先扣费
        if (filmCost > 0 && userId) {
            const billingResult = await __billing('consume', userId, filmCost, `写作助手(${totalChars}字符)`);
            if (!billingResult.success && !billingResult.skipped) {
                json(400, { success: false, error: 'BILLING_FAILED', error_code: 'BILLING_FAILED', message: billingResult.error || '扣费失败', billed: 0 });
                return;
            }
            billingSuccess = billingResult.success && !billingResult.skipped;
        }

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
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', 'roll', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: billingSuccess ? filmCost : 0, model: 'roll' });
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
        if ((preferMimo || (!preferYunwu && !useModelScope)) && WRITER_MIMO_API_KEY) {
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
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', 'MIMO', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: billingSuccess ? filmCost : 0 });
                    return;
                }
                console.warn('[writer-llm] MIMO API失败:', response.status);
            } catch (e) {
                console.warn('[writer-llm] MIMO API异常:', e.message);
            }
        }

        // 2b) 云雾（需配置模型，支持 grok-4-fast）
        if ((preferYunwu || (!preferMimo && !useModelScope)) && YUNMENG_API_KEY) {
            try {
                let yunwuModel = YUNMENG_MODEL || 'grok-4-fast';  // 🌟 默认使用 grok-4-fast
                if (modelLc === 'qwen-plus' || modelLc.startsWith('qwen-')) yunwuModel = reqModel;
                if (modelLc.startsWith('grok-')) yunwuModel = reqModel;  // 🌟 支持 grok 系列模型
                if (modelLc.startsWith('yunwu:')) yunwuModel = reqModel.split(':').slice(1).join(':') || 'grok-4-fast';
                const payload = {
                    model: yunwuModel,
                    messages: finalMessages,
                    max_tokens: max_completion_tokens,
                    temperature,
                    top_p,
                    stream: false
                };

                const url = `${YUNMENG_BASE_URL}/chat/completions`;
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${YUNMENG_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(120000)
                });

                if (response.ok) {
                    data = await response.json();
                    content = data?.choices?.[0]?.message?.content;
                    await __saveGenerationRecord(userId, 'text', content?.trim() || '', finalMessages[0]?.content || '', '云雾', filmCost, {});
                    json(200, { success: true, content: typeof content === 'string' ? content.trim() : '', raw: data, billed: billingSuccess ? filmCost : 0 });
                    return;
                }

                const errorText = await response.text();
                if (billingSuccess) {
                    await __billing('refund', userId, filmCost, '写作助手API失败退款');
                }
                json(500, { success: false, error: 'WRITER_LLM_FAILED', error_code: 'API_ERROR', status: response.status, message: errorText?.slice(0, 800) || '', billed: 0 });
                return;
            } catch (e) {
                console.warn('[writer-llm] 云雾API异常:', e.message);
            }
        }

        // 所有通道失败 → 退款
        if (billingSuccess) {
            await __billing('refund', userId, filmCost, '写作助手所有API失败退款');
        }
        json(500, { success: false, error: 'WRITER_LLM_FAILED', error_code: 'NO_API_AVAILABLE', message: '所有API通道均不可用', billed: 0 });
    } catch (error) {
        // 异常兜底退款
        try {
            if (typeof billingSuccess !== 'undefined' && billingSuccess) {
                await __billing('refund', userId, FILM_COST['text'] || 1, '写作助手异常退款');
            }
        } catch (e) { }
        json(500, { error: 'WRITER_LLM_FAILED', message: error?.message || String(error || '') });
    }
};
