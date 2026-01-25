# banana.html 触发 400 / 401 / 500 的原因分析（含快速定位方法）

> 适用范围：你当前的 `banana.html`（前端） + `/api/supabase-proxy`（后端代理）+ Supabase RPC  
> 本文解释：为什么会出现 **400 / 401 / 500**，分别代表什么、最常见根因、如何 3 分钟定位。

---

## 1. 一句话结论

你看到的 **400 / 401 / 500** 并不是同一个系统返回的：

- **401**：鉴权失败（前端没带 token / token 过期 / RLS 拦截）
- **400**：请求参数或数据库写入错误（类型错误、字段名错、约束触发、RPC 参数不匹配）
- **500**：你的 `/api/supabase-proxy` 服务端自己抛异常（没配置 service role、JSON 解析错、把 supabase 400 包成 500）

最常见组合是：

> Supabase 实际返回 **400**（比如 int 写入 5.5）  
> 你的 proxy 捕获错误后返回 **500**（吞掉了 status）  
> 前端又从 body 里读取到了 “400” → 于是你看到 **500 + 400** 同时出现

---

## 2. 错误码含义与常见原因对照表

| 错误码 | 发生位置（你的项目里） | 含义 | 最常见原因 |
|------|------------------|------|----------|
| **401** | `/api/supabase-proxy` 或 Supabase RPC | 未登录 / token 无效 / 无权限 | 没带 Authorization、token 过期、RLS 拦截、service key 不可用 |
| **400** | Supabase / RPC 返回 或 proxy 自己返回 | 请求参数错误 / DB 类型错误 / 约束错误 | 5.5 写入 int、字段名不对、RPC 参数名不匹配、扣成负数触发 CHECK |
| **500** | `/api/supabase-proxy`（你自己的服务端） | 你自己的 proxy 抛异常 | service role key 缺失、JSON parse 异常、supabase SDK error 没处理、把 400 包成 500 |

---

## 3. 为什么会出现 401（未授权）

### 3.1 前端请求没有带 token（最常见）

你前端调用的是：

```js
fetch('/api/supabase-proxy', { ... })
```

如果 headers 里没有：

```
Authorization: Bearer <jwt>
```

那么：

- proxy 如果检查 token → 直接 401  
- Supabase 如果启用了 RLS → `auth.uid()` 为 null → 401/403

✅ 快速检查：打开 DevTools → Network → 点开 `/api/supabase-proxy` → 看 Request Headers 是否包含 Authorization。

---

### 3.2 你从 NVAuth 获取 token 失败

如果你写：

```js
const session = await NVAuth.getSession?.();
const token = session?.access_token;
```

但 NVAuth.getSession 不存在 / 返回结构不同，则 token 永远是 null → 401。

✅ 建议加日志：

```js
console.log("session=", session);
console.log("token=", token);
```

---

## 4. 为什么会出现 400（参数错误/数据库错误）

400 大多数来自 Supabase（RPC 或 update 失败）。

### 4.1 最常见：int 字段写入了 5.5 / 7.5 / 2.5

你的定价表里有小数：

```js
'jimeng-4.5': 2.5,
'doubao-seedream-...': 7.5,
'nano-banana-2': 5.5,
```

如果数据库字段是 `integer`（int4/int8），写入 5.5 会直接报 400，例如：

> invalid input syntax for type integer: "5.5"

✅ 解决方案：
- 方案 A：全系统用最小单位整数（units），例如 1胶片=10units，5.5=55units（推荐）
- 方案 B：字段改成 numeric(18,2)

✅ 检查字段类型：

```sql
select data_type
from information_schema.columns
where table_name='user_profiles' and column_name='quota_balance';
```

---

### 4.2 RPC 参数名不匹配

例如你调用：

```js
reserve_film_units({ p_user_id, p_amount_units, p_request_id })
```

但数据库函数参数叫 `user_id / amount_units / request_id`，Supabase 会报 400：

- function does not exist
- missing required parameter

✅ 检查函数是否存在：

```sql
select routine_name
from information_schema.routines
where routine_name in (
  'reserve_film_units','commit_film_units','release_film_units','get_user_balance'
);
```

---

### 4.3 并发扣费导致 amount_remaining 负数，触发约束

多端并发或网络重试时：

- 两个请求同时扣同一个 lot
- amount_remaining 变负数
- 如果有 check constraint（>=0）则 400

✅ 解决：
- 扣费必须在数据库事务中执行，使用 `FOR UPDATE` 锁住 lot 行（RPC 原子化）

---

### 4.4 proxy 层主动返回 400（参数校验）

比如 proxy 里写了：

```js
if (!match) return 400
```

这种 400 并非 Supabase 返回。

✅ 检查：Network → Response body 看 error 内容。

---

## 5. 为什么会出现 500（proxy 自己的错误）

你看到：

```
POST /api/supabase-proxy 500
```

说明你的 proxy 代码抛异常或吞掉了 Supabase status。

### 5.1 最常见：没有配置 `SUPABASE_SERVICE_ROLE_KEY`

如果 proxy 用：

```js
process.env.SUPABASE_SERVICE_ROLE_KEY
```

线上没配置，会导致写入失败、权限错误等；你若 `throw error` 就变成 500。

✅ 检查部署环境变量。

---

### 5.2 JSON parse 异常（body 已经是对象但又 JSON.parse）

Next.js 默认会把 req.body 解析为对象；如果你又写：

```js
JSON.parse(req.body)
```

会抛异常 → 500。

---

### 5.3 把 Supabase 的 400 全部 throw，导致前端只看到 500

错误做法：

```js
if (error) throw error;
```

正确做法：

```js
return res.status(error.status || 400).json({
  error: error.message,
  details: error.details,
  hint: error.hint,
  code: error.code,
});
```

---

## 6. 3 分钟定位根因（最推荐）

### 步骤 1：看 Network 的 Response Body

DevTools → Network → `/api/supabase-proxy` → Response

你会看到真实错误，比如：

- invalid input syntax for type integer
- permission denied
- function does not exist
- violates check constraint

这比看 status 更重要。

---

### 步骤 2：proxy 打印 error（不要吞）

在 `/api/supabase-proxy` 加：

```js
console.error("[supabase-proxy] error:", error);
```

并透传：

```js
return res.status(error.status || 400).json(error);
```

---

### 步骤 3：确认请求 headers 有 Authorization

没有 Authorization 直接导致 401 或 RLS 拦截。

---

## 7. 最常见根因总结（按你这个项目的概率排序）

1. **字段类型是 int，但写入了 5.5**  
2. **RPC 参数名不对 / RPC 不存在**  
3. **请求没带 token，RLS 拦截导致 401**  
4. **proxy 没配 service role key / JSON parse 错导致 500**  
5. **并发扣费导致 lot 负数触发约束**

---

## 8. 你给我这两样，我可以直接帮你精确定位

1) `/api/supabase-proxy` 的完整代码  
2) Network 中 `/api/supabase-proxy` 的 Response body

我可以直接告诉你是哪一个字段/哪一个 RPC 参数/哪个约束触发，以及对应修复方法。

---

**完。**
