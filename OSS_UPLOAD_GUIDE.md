# 📤 阿里云OSS自动上传指南

## 🎯 准备工作

### 第1步：获取AccessKey

1. 访问：https://ram.console.aliyun.com/manage/ak
2. 点击 **"创建AccessKey"**
3. 会弹出窗口显示：
   - AccessKey ID（类似：LTAI5tXXXXXXXXXX）
   - AccessKey Secret（类似：xxxxxxxxxxxxxxx）
4. **⚠️ 务必保存好！只显示一次！**

### 第2步：配置上传脚本

1. 打开文件：`upload-to-oss.ps1`
2. 找到配置区域（第11-12行）：
   ```powershell
   $ACCESS_KEY_ID = ""  # 填写你的AccessKey ID
   $ACCESS_KEY_SECRET = ""  # 填写你的AccessKey Secret
   ```
3. 把你的AccessKey粘贴进去：
   ```powershell
   $ACCESS_KEY_ID = "LTAI5tXXXXXXXXXX"
   $ACCESS_KEY_SECRET = "xxxxxxxxxxxxxxx"
   ```
4. 保存文件

---

## 🚀 开始上传

### 方法1：双击运行（最简单）

1. 在项目文件夹中
2. 找到 `upload-to-oss.ps1`
3. **右键** → **"使用PowerShell运行"**
4. 等待上传完成

### 方法2：命令行运行

```powershell
cd J:\123pan\13998416173\NanoNoPort\ai-video-batch
.\upload-to-oss.ps1
```

---

## 📊 上传过程

脚本会自动：
1. ✅ 检查AccessKey配置
2. ✅ 下载ossutil工具（首次使用）
3. ✅ 配置OSS连接
4. ✅ 上传所有文件（自动排除不需要的文件）
5. ✅ 显示上传结果

**自动排除的文件**：
- `.ps1` 脚本文件
- `.sh` 脚本文件
- `.md` 文档文件
- `.git/` 版本控制
- `node_modules/` 依赖包
- `ossutil*` 工具文件

---

## ✅ 上传完成后

脚本会提示你接下来的步骤：

### 第1步：开启静态网站托管
```
OSS控制台 → 基础设置 → 静态页面
默认首页: index.html
默认404页: index.html
```

### 第2步：绑定域名
```
OSS控制台 → 传输管理 → 域名管理
域名: lossloop.cn
☑️ 自动添加CNAME记录
☑️ CDN加速 ← 必须勾选！
```

### 第3步：配置DNS
```
阿里云DNS → lossloop.cn → 解析设置
类型: CNAME
主机记录: @
记录值: (系统给你的CNAME地址)
```

---

## 🔄 更新网站

以后如果要更新网站内容：

1. 修改本地文件
2. 再次运行 `upload-to-oss.ps1`
3. 脚本会自动覆盖更新
4. 可能需要刷新CDN缓存

---

## ⚠️ 常见问题

### Q1: 脚本运行报错 "无法运行脚本"
**A**: Windows默认禁止运行PowerShell脚本

解决方法：
```powershell
# 以管理员身份运行PowerShell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q2: 上传失败 "AccessDenied"
**A**: AccessKey权限不足或错误

解决方法：
- 检查AccessKey是否正确
- 确保AccessKey有OSS权限
- 尝试重新创建AccessKey

### Q3: 上传很慢
**A**: 网络问题

解决方法：
- 检查网络连接
- 尝试使用其他网络
- 文件太大可能需要较长时间

### Q4: 找不到ossutil
**A**: 自动下载失败

解决方法：
- 手动下载：https://help.aliyun.com/document_detail/120075.html
- 下载后重命名为 `ossutil64.exe`
- 放到项目根目录

---

## 🔒 安全提醒

1. **不要把AccessKey提交到Git**
2. **不要分享AccessKey给他人**
3. **定期更换AccessKey**
4. **上传完成后脚本会自动删除配置文件**

---

## 💰 费用说明

- **存储费**：¥0.12/GB/月
- **流量费**：¥0.5/GB（超出免费额度后）
- **免费额度**：每月5GB存储 + 5GB流量

**预估**：
- 你的项目约50MB
- 月流量如果10GB
- 预估费用：¥0.01（存储）+ ¥2.5（流量）= **约¥3/月**

---

## 📝 完整流程总结

```
1. 获取AccessKey
   ↓
2. 配置 upload-to-oss.ps1
   ↓
3. 运行脚本上传文件
   ↓
4. OSS开启静态网站托管
   ↓
5. 绑定域名并开启CDN
   ↓
6. 配置DNS
   ↓
7. 等待生效（15分钟）
   ↓
8. 访问 lossloop.cn 🎉
```

---

**准备好了吗？现在去获取AccessKey吧！** 🚀

