# 🚀 AI 视频批量创作工具 - 部署指南

本文档将指导您将项目免费部署到 **Vercel** 平台，并绑定您的个人域名 **lossloop.cn**。

## 📋 准备工作

1.  **Vercel 账号**：访问 [vercel.com](https://vercel.com) 注册（推荐使用 GitHub 登录）。
2.  **Cloudflare 账号**：由于您的域名 DNS 指向 Cloudflare，需要登录 [cloudflare.com](https://www.cloudflare.com) 管理解析。
3.  **Node.js 环境**：确保本地已安装 Node.js。

---

## 第一步：部署代码到 Vercel

我们将使用 Vercel 命令行工具 (CLI) 将本地代码上传到云端。

1.  **打开终端**
    在项目根目录 (`J:\123pan\13998416173\NanoNoPort`) 打开终端。

2.  **进入子项目目录** (⚠️ 重要)
    ```bash
    cd ai-video-batch
    ```
    *必须先进入这个目录，否则会把您的主项目一起部署上去！*

3.  **安装 Vercel CLI** (如果未安装)
    ```bash
    npm install -g vercel --registry=https://registry.npmmirror.com
    ```

4.  **登录 Vercel**
    ```bash
    vercel login
    ```
    *   选择登录方式（如 GitHub），浏览器会弹出确认窗口，点击 "Login"。

4.  **一键部署**
    运行以下命令：
    ```bash
    vercel
    ```
    按照以下提示操作（一路回车即可）：
    *   `Set up and deploy?` -> 输入 **Y** (回车)
    *   `Which scope do you want to deploy to?` -> **回车** (选择您的账号)
    *   `Link to existing project?` -> 输入 **N** (回车)
    *   `Project name?` -> **ai-video-batch** (回车，或者输入您喜欢的名字)
    *   `In which directory is your code located?` -> **./** (直接回车)
    *   `Want to modify these settings?` -> **N** (回车)

    🍵 **稍等片刻**... 当终端显示 `Production: https://ai-video-batch-xxxx.vercel.app` 时，说明部署成功！

---

## 第二步：在 Vercel 绑定域名

1.  登录 [Vercel 控制台](https://vercel.com/dashboard)。
2.  点击刚才部署的项目 (**ai-video-batch**)。
3.  点击顶部菜单栏的 **Settings** (设置)。
4.  点击左侧菜单的 **Domains** (域名)。
5.  在输入框中输入：`lossloop.cn`，点击 **Add**。
6.  Vercel 会显示两条建议的 DNS 记录（通常是 A 记录），请保持这个页面开启，我们需要用到里面的数据。
    *   **Type**: `A`
    *   **Value**: `76.76.21.21`

---

## 第三步：在 Cloudflare 配置解析

由于您的阿里云后台显示 DNS 服务器为 `john.ns.cloudflare.com`，说明解析权在 Cloudflare。

1.  登录 [Cloudflare](https://www.cloudflare.com/)。
    *   *如果您忘记了账号，请看文末的“常见问题”。*
2.  点击您的域名 **lossloop.cn**。
3.  在左侧菜单点击 **DNS** -> **Records** (记录)。
4.  **添加主域名记录**：
    *   点击 **Add record**。
    *   **Type (类型)**: 选择 `A`。
    *   **Name (名称)**: 输入 `@`。
    *   **IPv4 address (内容)**: 输入 `76.76.21.21` (这是 Vercel 的服务器 IP)。
    *   **Proxy status (代理状态)**: **⚠️ 关键一步：先点击小云朵图标，使其变为灰色 (DNS Only)**。
        *   *原因：开启代理可能会导致 SSL 证书颁发变慢，建议等 Vercel 显示绿色的 "Valid" 后再回来开启小云朵以获得 CDN 加速。*
    *   点击 **Save**。

5.  **(可选) 添加 www 记录**：
    *   点击 **Add record**。
    *   **Type**: `CNAME`。
    *   **Name**: 输入 `www`。
    *   **Target**: 输入 `cname.vercel-dns.com`。
    *   **Proxy status**: 关闭 (灰色)。
    *   点击 **Save**。

---

## 第四步：验证与使用

1.  回到 **Vercel Domains** 页面，刷新一下。
2.  当域名状态显示为两个绿色的对勾 (✅ Valid Configuration) 时，说明解析生效了。
3.  访问 **https://lossloop.cn**。
4.  **关键配置**：
    *   点击页面左下角的 **"⚙️ 设置"**。
    *   输入您的 **贞贞工坊 (T8Star) Key** 和 **RunningHub Key**。
    *   开始创作！

---

## ❓ 常见问题

### Q1: 我彻底忘记 Cloudflare 账号了，怎么办？
如果您无法登录 Cloudflare，您可以收回 DNS 解析权：
1.  登录 **阿里云域名控制台**。
2.  找到 `lossloop.cn`，点击 **DNS修改**。
3.  点击 **修改DNS服务器** -> **恢复默DNS** (通常是 `dns*.hichina.com`)。
4.  保存后，等待约 2-24 小时生效。
5.  生效后，您就可以直接在阿里云的 **云解析DNS** 里面添加上面的 A 记录了。

### Q2: 为什么访问显示 404？
*   确保您的 `vercel.json` 文件已上传（我们在前面的步骤中已经创建了它）。
*   确保您访问的是 `https://lossloop.cn` 或 `https://lossloop.cn/index.html`。

### Q3: 如何更新网站内容？
如果您在本地修改了代码（比如修改了界面），只需在终端再次运行：
```bash
vercel --prod
```
代码就会自动同步更新到线上。

---

## 🔀 双域名部署策略

**域名配置**：
| 域名 | 用途 | 说明 |
|------|------|------|
| www.rollroll.art | 🏠 稳定运行 | 生产环境，用户访问 |
| www.lossloop.cn | 🔧 功能调试 | 测试环境，开发调试 |

**部署命令**：
```powershell
# 🔧 调试开发 - 部署到 lossloop.cn 测试新功能
vercel deploy --yes ; vercel alias set www.lossloop.cn

# 🏠 稳定发布 - 确认没问题后部署到 rollroll.art
vercel deploy --prod --yes ; vercel alias set www.rollroll.art
```

**工作流程**：
1. 开发新功能 → 部署到 **lossloop.cn** 测试
2. 测试没问题 → 部署到 **rollroll.art** 正式上线
3. 用户始终使用稳定的 rollroll.art，不受调试影响

