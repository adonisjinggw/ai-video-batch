# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
AI视频批量创作工具 (RollRoll) - A serverless AI video batch creation platform using Vercel + vanilla JavaScript. Users input creative themes to generate AI scripts, images, and Sora2 video prompts.

**Primary domains**: `rollroll.art`, `lossloop.cn`

## Build and Development Commands

```bash
# Local development with Vercel CLI
npm run dev           # vercel dev

# Deploy
npm run predeploy     # Sync version (scripts/sync-version.js)
npm run deploy        # vercel --prod
npm run deploy:stable # vercel deploy --prod --yes
npm run deploy:dev    # vercel deploy --yes
```

**Note**: No build step required - pure HTML/CSS/JS frontend served directly by Vercel.

## Architecture

### Frontend (Browser)
- `index.html` - Main PC page (auto-redirects mobile to `mobile.html`)
- `js/batch.js` - Core frontend logic: video generation workflow, character image variants, API calls
- `js/supabase-config.js` - Supabase client initialization, auth state management, session caching
- `js/billing.js` - Frontend billing/quota helpers
- `css/style.css` - All styling

### Backend (Vercel Serverless Functions in `/api`)
Each file exports a single `handler(req, res)` function:

| File | Purpose | Key Dependencies |
|------|---------|------------------|
| `sora2.js` | Sora2 video generation proxy | 云梦/云雾 API (YUNMENG_API_KEY) |
| `banana2.js` | Image generation (Banana2, Seedream, etc.) | YUNMENG_API_KEY, MODELSCOPE_API_KEY |
| `yunwu.js` | Multi-modal AI: image/video/text/TTS | YUNWU_API_KEY |
| `video-continuity.js` | Serial video generation with frame chaining | Uses sora2/yunwu internally |
| `writer-llm.js` | LLM text generation for scripts | MIMO API, YUNMENG, MODELSCOPE |
| `proxy.js` | Generic API proxy + VIP code verification | VIP_SECRET |
| `supabase-proxy.js` | Database operations, billing, auth proxy | SUPABASE_SERVICE_KEY |
| `modelscope.js` | ModelScope image generation (free tier) | MODELSCOPE_API_KEY |
| `cron-billing.js` | Daily billing cron job | Runs at 03:00 UTC |

### Billing System
All paid operations use a unified pattern:
1. Call `__billing('consume', userId, amount, description)` before operation
2. On failure, call `__billing('refund', userId, amount, description)`
3. Billing routes through `/api/supabase-proxy` with `action: 'consume'` or `action: 'recharge'`

Film costs are defined as constants at the top of each API file (e.g., `FILM_COST` object).

### External API Priorities
The codebase implements multi-endpoint fallback for reliability:
1. **Primary**: 云梦/云雾 API endpoints (`api3.wlai.vip`, `yunwu.zeabur.app`, `yunwu.ai`, `api.apiplus.org`)
2. **Fallback**: ModelScope (free, for degraded experience)
3. **Disabled**: 贞贞/t8star API (hard-disabled via `ALLOW_ZHENZHEN = false`)

### Auth Flow
- Supabase Auth with session caching in localStorage/sessionStorage/cookies
- Auth state managed via `onAuthStateChange` listener in `supabase-config.js`
- Server-side auth proxy in `supabase-proxy.js` for faster China access

## Required Environment Variables

```bash
# Core (required for most features)
YUNMENG_API_KEY         # Primary AI API key
YUNMENG_API_KEY_2       # Backup key (optional)
YUNMENG_API_KEY_3       # Backup key (optional)
SUPABASE_SERVICE_KEY    # Supabase service role key

# Feature-specific
VIP_SECRET              # For VIP code verification in proxy.js
MODELSCOPE_API_KEY      # ModelScope API (fallback images)
WRITER_MIMO_API_KEY     # MIMO LLM for script writing
RUNNINGHUB_API_KEY      # Video HD upscaling
```

## Key Patterns

### API Handler Pattern
```javascript
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
    
    // ... handler logic
};
```

### Multi-Endpoint Fallback
```javascript
for (const endpoint of YUNMENG_ENDPOINTS) {
    for (const apiKey of YUNMENG_API_KEYS) {
        try {
            const response = await fetch(`${endpoint}${apiPath}`, { ... });
            if (response.ok) return response;
            // Continue to next endpoint/key on failure
        } catch (err) { /* try next */ }
    }
}
```

### Frontend API Calls
Frontend in `batch.js` calls APIs via:
- Direct fetch to `/api/sora2`, `/api/banana2`, etc.
- Helper functions like `callBanana2ImageAPI()`, `callModelScopeImageAPI()`

## Vercel Configuration

`vercel.json` defines:
- Function timeouts: 180s for most, 300s for `yunwu.js` and `cron-billing.js`
- Daily cron: `/api/cron-billing` at 03:00 UTC
- Cache-Control headers: `no-cache` for all HTML/JS/CSS (development mode)

## Important Notes

1. **No test framework** - This is a production prototype without unit tests
2. **Chinese comments** - Most code comments are in Chinese
3. **Billing-first design** - Always check for `userId` before expensive operations
4. **Rate limiting** - `proxy.js` implements simple IP-based rate limiting (120 req/60s)
5. **CORS allowlist** - `proxy.js` restricts origins to specific domains
