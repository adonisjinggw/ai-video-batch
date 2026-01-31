const SUPABASE_URL = 'https://tdoquxvslsuhwgiqwbrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

function __round2(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function __daysBetween(isoA, isoB) {
    const a = isoA ? new Date(isoA).getTime() : 0;
    const b = isoB ? new Date(isoB).getTime() : 0;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 99999;
    return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

function __getRetentionStage(days) {
    if (days >= 90) return 3;
    if (days >= 60) return 2;
    if (days >= 30) return 1;
    return 0;
}

function __getRetentionRatio(stage) {
    if (stage === 1) return 0.7;
    if (stage === 2) return 0.3;
    if (stage === 3) return 0.0;
    return 1.0;
}

async function __sumActiveLots(headers, userId, nowIso) {
    const q = `${SUPABASE_URL}/rest/v1/film_lots?user_id=eq.${userId}&amount_remaining=gt.0&expires_at=gt.${encodeURIComponent(nowIso)}&select=amount_remaining&limit=1000`;
    const r = await fetch(q, { headers });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => ([]));
    const sum = (Array.isArray(rows) ? rows : []).reduce((acc, it) => acc + (Number(it?.amount_remaining) || 0), 0);
    return __round2(sum);
}

async function __patchProfile(headers, userId, patch) {
    const url = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`;
    const r = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch || {})
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `PATCH user_profiles failed: ${r.status}`);
    }
}

async function __insertQuotaLog(headers, row) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/quota_logs`;
        await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(row)
        });
    } catch (e) {
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const auth = String(req.headers.authorization || '').trim();
    const headerSecret = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const querySecret = String((req.query && req.query.secret) || (req.body && req.body.secret) || '').trim();
    const vercelCron = String(req.headers['x-vercel-cron'] || '').trim();

    if (CRON_SECRET) {
        const ok = (headerSecret && headerSecret === CRON_SECRET) || (querySecret && querySecret === CRON_SECRET) || vercelCron === '1';
        if (!ok) {
            res.status(403).json({ error: 'FORBIDDEN' });
            return;
        }
    }

    if (!SUPABASE_SERVICE_KEY) {
        res.status(500).json({ error: 'SERVER_CONFIG_ERROR', message: 'missing SUPABASE_SERVICE_KEY' });
        return;
    }

    const headers = {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
    };

    const nowIso = new Date().toISOString();
    const affectedUsers = new Set();
    let expiredLotsProcessed = 0;
    let revokeUsersProcessed = 0;

    try {
        const testLots = await fetch(`${SUPABASE_URL}/rest/v1/film_lots?select=id&limit=1`, { headers });
        if (testLots.ok) {
            const q = `${SUPABASE_URL}/rest/v1/film_lots?expires_at=lte.${encodeURIComponent(nowIso)}&amount_remaining=gt.0&select=id,user_id,amount_remaining&limit=1000`;
            const r = await fetch(q, { headers });
            if (r.ok) {
                const rows = await r.json().catch(() => ([]));
                for (const it of (Array.isArray(rows) ? rows : [])) {
                    const id = it?.id;
                    const uid = it?.user_id;
                    if (!id) continue;
                    const patchUrl = `${SUPABASE_URL}/rest/v1/film_lots?id=eq.${id}`;
                    const pr = await fetch(patchUrl, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ amount_remaining: 0, status: 'expired' })
                    });
                    if (pr.ok) {
                        expiredLotsProcessed += 1;
                        if (uid) affectedUsers.add(uid);
                    }
                }
            }
        }
    } catch (e) {
    }

    try {
        const testProfile = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=id,gift_film_balance,gift_revoke_stage,last_login_at,quota_balance&gift_film_balance=gt.0&limit=1`, { headers });
        if (testProfile.ok) {
            const q = `${SUPABASE_URL}/rest/v1/user_profiles?gift_film_balance=gt.0&select=id,gift_film_balance,gift_revoke_stage,last_login_at,quota_balance&limit=1000`;
            const r = await fetch(q, { headers });
            if (r.ok) {
                const rows = await r.json().catch(() => ([]));
                for (const p of (Array.isArray(rows) ? rows : [])) {
                    const uid = p?.id;
                    if (!uid) continue;
                    const giftBal = Number(p?.gift_film_balance) || 0;
                    if (giftBal <= 0) continue;
                    const curStage = parseInt(p?.gift_revoke_stage, 10) || 0;
                    const days = __daysBetween(p?.last_login_at, nowIso);
                    const targetStage = __getRetentionStage(days);
                    if (targetStage <= curStage) continue;

                    const ratio = __getRetentionRatio(targetStage);
                    const nextGift = __round2(giftBal * ratio);
                    const revoked = __round2(giftBal - nextGift);

                    await __patchProfile(headers, uid, {
                        gift_film_balance: nextGift,
                        gift_revoke_stage: targetStage
                    });

                    revokeUsersProcessed += 1;
                    affectedUsers.add(uid);

                    await __insertQuotaLog(headers, {
                        user_id: uid,
                        action_type: 'gift_revoke',
                        amount: -revoked,
                        balance_after: Number(p?.quota_balance || 0),
                        description: `gift_revoke_stage_${targetStage} (${days}d)`
                    });
                }
            }
        }
    } catch (e) {
    }

    let balancesSynced = 0;
    for (const uid of affectedUsers) {
        try {
            const profUrl = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${uid}&select=gift_film_balance,quota_balance`;
            const pr = await fetch(profUrl, { headers });
            if (!pr.ok) continue;
            const rows = await pr.json().catch(() => ([]));
            const row = rows?.[0] || null;
            if (!row) continue;
            const giftBal = Number(row?.gift_film_balance) || 0;
            const currentBalance = Number(row?.quota_balance) || 0;
            const lotsSum = await __sumActiveLots(headers, uid, nowIso);
            if (lotsSum === null) continue;
            const calculatedTotal = __round2(giftBal + lotsSum);
            // 用户可能有直接充值的余额（不通过gift/lots），不能覆盖
            // 只有当计算值 > 0 且与当前值不同时才更新
            if (calculatedTotal > 0 && calculatedTotal !== currentBalance) {
                await __patchProfile(headers, uid, { quota_balance: calculatedTotal });
                balancesSynced += 1;
            }
        } catch (e) {
        }
    }

    res.status(200).json({
        success: true,
        now: nowIso,
        expiredLotsProcessed,
        revokeUsersProcessed,
        affectedUsers: affectedUsers.size,
        balancesSynced
    });
};
