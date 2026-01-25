/**
 * 通用两阶段扣费模块
 * 用于所有 AI 功能的统一计费
 * 
 * 流程：reserve（冻结）→ 调用API → commit（确认）/ release（释放）
 */

const FILM_UNIT = 10; // 1胶片 = 10 units

// 胶片转换为 units
function filmToUnits(film) {
    return Math.round(Number(film) * FILM_UNIT);
}

// units 转换为胶片（显示用）
function unitsToFilm(units) {
    return (Number(units) / FILM_UNIT).toFixed(1);
}

// 调用 Supabase RPC
async function callBillingRPC(rpc, rpcArgs) {
    const res = await fetch('/api/supabase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rpc', rpc, rpcArgs })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error('[billing] RPC 失败:', res.status, json);
        const errMsg = json?.error || json?.message || `RPC failed: ${res.status}`;
        throw new Error(errMsg);
    }
    return json.data;
}

// 获取用户余额（统一口径）
async function getUserBalance(userId) {
    return await callBillingRPC('get_user_balance', { p_user_id: userId });
}

// 预扣费冻结
async function reserveFilm(userId, filmCost, requestId) {
    const units = filmToUnits(filmCost);
    return await callBillingRPC('reserve_film_units', {
        p_user_id: userId,
        p_amount_units: units,
        p_request_id: requestId
    });
}

// 确认扣费（生成成功）
async function commitFilm(userId, requestId) {
    return await callBillingRPC('commit_film_units', {
        p_user_id: userId,
        p_request_id: requestId
    });
}

// 释放冻结（生成失败）
async function releaseFilm(userId, requestId) {
    return await callBillingRPC('release_film_units', {
        p_user_id: userId,
        p_request_id: requestId
    });
}

/**
 * 执行带扣费的 API 调用（两阶段扣费）
 * @param {Object} options
 * @param {string} options.userId - 用户ID
 * @param {number} options.filmCost - 胶片消耗（如 5.5）
 * @param {Function} options.apiCall - API 调用函数，返回 Promise
 * @param {Function} options.onBalanceUpdate - 余额更新回调 (balance) => void
 * @param {string} options.description - 操作描述（用于日志）
 * @returns {Promise<any>} API 调用结果
 */
async function executeWithBilling({ userId, filmCost, apiCall, onBalanceUpdate, description }) {
    const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    console.log(`[billing] 开始 ${description}, 消耗 ${filmCost} 胶片, requestId=${requestId}`);
    
    // 免费操作直接执行
    if (!filmCost || filmCost <= 0) {
        return await apiCall();
    }
    
    // 1. 预扣费冻结
    let reserved = false;
    try {
        const balanceAfterReserve = await reserveFilm(userId, filmCost, requestId);
        reserved = true;
        
        // 更新前端余额显示
        if (onBalanceUpdate && balanceAfterReserve) {
            const totalUnits = balanceAfterReserve.total_balance_units || 0;
            onBalanceUpdate(unitsToFilm(totalUnits));
        }
        console.log(`[billing] 冻结成功: ${filmCost} 胶片`);
    } catch (e) {
        console.error('[billing] 冻结失败:', e);
        if (e.message && e.message.includes('INSUFFICIENT_BALANCE')) {
            throw new Error('余额不足，请先充值');
        }
        throw new Error('扣费失败: ' + e.message);
    }
    
    // 2. 执行 API 调用
    try {
        const result = await apiCall();
        
        // 3. 成功：确认扣费
        try {
            const balanceAfterCommit = await commitFilm(userId, requestId);
            if (onBalanceUpdate && balanceAfterCommit) {
                const totalUnits = balanceAfterCommit.total_balance_units || 0;
                onBalanceUpdate(unitsToFilm(totalUnits));
            }
            console.log(`[billing] 确认扣费成功: ${filmCost} 胶片`);
        } catch (commitErr) {
            console.error('[billing] 确认扣费失败:', commitErr);
            // 确认失败不影响结果返回，但需要记录
        }
        
        return result;
    } catch (apiError) {
        // 4. 失败：释放冻结
        console.error(`[billing] ${description} 失败:`, apiError);
        if (reserved) {
            try {
                const balanceAfterRelease = await releaseFilm(userId, requestId);
                if (onBalanceUpdate && balanceAfterRelease) {
                    const totalUnits = balanceAfterRelease.total_balance_units || 0;
                    onBalanceUpdate(unitsToFilm(totalUnits));
                }
                console.log(`[billing] 释放冻结成功: ${filmCost} 胶片已返还`);
            } catch (releaseErr) {
                console.error('[billing] 释放冻结失败:', releaseErr);
            }
        }
        throw apiError;
    }
}

// 兼容旧版：直接扣费（不推荐，仅用于过渡）
async function consumeFilmLegacy(userId, amount, description) {
    const res = await fetch('/api/supabase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consume', userId, amount, description })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `扣费失败: ${res.status}`);
    }
    return data;
}

// 兼容旧版：退款（不推荐，仅用于过渡）
async function refundFilmLegacy(userId, amount, description) {
    const res = await fetch('/api/supabase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recharge', userId, amount, description })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `退款失败: ${res.status}`);
    }
    return data;
}

// 导出到全局
window.Billing = {
    FILM_UNIT,
    filmToUnits,
    unitsToFilm,
    getUserBalance,
    reserveFilm,
    commitFilm,
    releaseFilm,
    executeWithBilling,
    // 兼容旧版
    consumeLegacy: consumeFilmLegacy,
    refundLegacy: refundFilmLegacy
};

console.log('[billing] 扣费模块已加载');
