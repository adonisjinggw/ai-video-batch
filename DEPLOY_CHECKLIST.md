# RollRoll AI V9.0.0.1 部署配置清单

## ✅ 已完成的修改

### 1. 版本号统一
- [x] `index.html`: V8.10.2 → **V9.0.0.1**
- [x] `mobile.html`: V9.2.1 → **V9.0.0.1**

## 🔍 问题诊断结果

### 问题1：混元3D功能无反应
**状态**: 代码完整，API已配置
**原因**: 需要验证 `YUNWU_API_KEY` 是否正确被Vercel读取

**代码位置**:
- API提交: `api/yunwu.js` 行4931-4995
- API查询: `api/yunwu.js` 行4997-5045
- PC端入口: `index.html` 行2597-2823
- 计费: 30胶片/次

**API端点**:
- 提交: `https://api3.wlai.vip/alibailian/api/v1/services/aigc/text-to-3d`
- 查询: `https://api3.wlai.vip/alibailian/api/v1/tasks/{jobId}`

### 问题2：OCR Deepseek模型无反应
**状态**: 代码完整，API已配置
**原因**: 需要验证云雾API端点是否可用

**代码位置**:
- API: `api/yunwu.js` 行947-1034
- 模型映射: `'deepseek-ocr': 'deepseek-ocr'`
- 计费: 2胶片/次

### 问题3：AI写真技能500错误
**状态**: 代码完整，API已配置
**原因**: 需要验证 qwen-image-max 模型调用

**代码位置**:
- 技能定义: `js/skill-presets.js` 行4479-4536
- API: `api/banana2.js` 行421-615 (callQwenImageMax)
- 计费: 8胶片/次 (3张图 = 24胶片)

## 📋 环境变量配置

### 当前 `.env.local` 配置
```bash
YUNWU_API_KEY="sk-oPSyBga48695VbcN8w22aOdYHNawEac9iQSx0XFXuOkZHId6"
YUNMENG_API_KEY="sk-oPSyBga48695VbcN8w22aOdYHNawEac9iQSx0XFXuOkZHId6"
MODELSCOPE_API_KEY="ms-6e7651bd-dce8-4d5e-ba8f-78f9cecebc12"
HUNYUAN3D_API_KEY="sk-2I5B2Fa0MYSO8zLKQiN4CKCNR9fpT8GDsFb3erzZNsabCJmq"
```

### ⚠️ 发现的问题
所有API密钥值后面都有 `\r\n"` 字符，可能导致解析错误。

### 🚀 部署到Vercel时需要的环境变量

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `YUNWU_API_KEY` | sk-oPSyBga48695VbcN8w22aOdYHNawEac9iQSx0XFXuOkZHId6 | 云雾API（OCR、AI写真） |
| `YUNMENG_API_KEY` | sk-oPSyBga48695VbcN8w22aOdYHNawEac9iQSx0XFXuOkZHId6 | 云梦API备用 |
| `MODELSCOPE_API_KEY` | ms-6e7651bd-dce8-4d5e-ba8f-78f9cecebc12 | ModelScope（qwen-image-max） |
| `SUPABASE_SERVICE_KEY` | eyJhbGci...（已配置） | Supabase服务端密钥 |
| `RUNNINGHUB_API_KEY` | a380bfb6f25b4733ad6756a0bb0a8403 | RunningHub API |
| `WRITER_MIMO_API_KEY` | sk-cahja...（已配置） | 写作API |

## 🔧 验证步骤

### 1. 部署前检查
- [x] 版本号已统一为 V9.0.0.1
- [x] 代码无语法错误
- [ ] 环境变量已正确配置到Vercel

### 2. 部署后测试

#### 混元3D测试
1. 点击"混元生3D"按钮
2. 输入提示词"一只可爱的熊猫"
3. 点击生成
4. 检查是否扣费30胶片
5. 等待1-3分钟
6. 验证GLB文件下载

#### OCR Deepseek测试
1. 上传测试图片
2. 选择"OCR文字识别"
3. 提交请求
4. 验证返回文字正确

#### AI写真测试
1. 上传人像照片
2. 选择"时尚大片"风格
3. 点击生成
4. 验证3张写真都生成成功

## 📝 Vercel部署命令

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署（生产环境）
vercel --prod

# 查看环境变量
vercel env ls
```

## 🚨 可能的错误原因

### 1. API密钥格式错误
**症状**: 401/403错误
**解决**: 去除 `\r\n"` 字符，只保留纯密钥字符串

### 2. Vercel环境变量未设置
**症状**: "云雾API未配置"
**解决**: 在Vercel控制台设置环境变量

### 3. API端点不可达
**症状**: 请求超时
**解决**: 检查 `api3.wlai.vip` 是否可访问

### 4. 计费系统错误
**症状**: 扣费失败
**解决**: 检查Supabase配置和用户余额

## 📞 技术支持

如遇问题，请检查：
1. Vercel部署日志
2. 浏览器控制台错误
3. API返回的详细错误信息

---

**生成时间**: 2026-04-05
**版本**: V9.0.0.1
**状态**: 待部署测试