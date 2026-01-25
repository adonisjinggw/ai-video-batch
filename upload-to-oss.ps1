# 阿里云OSS自动上传脚本
# PowerShell版本 - 适用于Windows

Write-Host "🚀 阿里云OSS自动上传工具" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# ====== 配置信息（请填写） ======
$BUCKET_NAME = "lossloop-cn"
$REGION = "oss-cn-beijing"  # 华北2（北京）
$ACCESS_KEY_ID = ""  # ⚠️ 请填写你的AccessKey ID
$ACCESS_KEY_SECRET = ""  # ⚠️ 请填写你的AccessKey Secret

# ====== 检查配置 ======
if ([string]::IsNullOrEmpty($ACCESS_KEY_ID) -or [string]::IsNullOrEmpty($ACCESS_KEY_SECRET)) {
    Write-Host "❌ 错误: 请先配置AccessKey" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 如何获取AccessKey:" -ForegroundColor Yellow
    Write-Host "1. 访问: https://ram.console.aliyun.com/manage/ak" -ForegroundColor Yellow
    Write-Host "2. 点击 '创建AccessKey'" -ForegroundColor Yellow
    Write-Host "3. 复制 AccessKey ID 和 AccessKey Secret" -ForegroundColor Yellow
    Write-Host "4. 粘贴到本脚本的配置区域" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit
}

# ====== 检查ossutil工具 ======
$ossutilPath = ".\ossutil64.exe"

if (-not (Test-Path $ossutilPath)) {
    Write-Host "📥 首次使用，正在下载 ossutil 工具..." -ForegroundColor Yellow
    Write-Host ""
    
    # 下载ossutil
    $downloadUrl = "https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil-v1.7.18-windows-amd64.zip"
    $zipFile = ".\ossutil.zip"
    
    try {
        Write-Host "⏬ 下载中..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
        
        Write-Host "📦 解压中..." -ForegroundColor Cyan
        Expand-Archive -Path $zipFile -DestinationPath ".\ossutil_temp" -Force
        
        # 移动文件
        Move-Item ".\ossutil_temp\ossutil-v1.7.18-windows-amd64\ossutil64.exe" ".\ossutil64.exe" -Force
        
        # 清理
        Remove-Item $zipFile -Force
        Remove-Item ".\ossutil_temp" -Recurse -Force
        
        Write-Host "✅ ossutil 下载完成!" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "❌ 下载失败: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "请手动下载:" -ForegroundColor Yellow
        Write-Host "https://help.aliyun.com/document_detail/120075.html" -ForegroundColor Yellow
        pause
        exit
    }
}

# ====== 配置ossutil ======
Write-Host "⚙️ 配置 ossutil..." -ForegroundColor Cyan

$configContent = @"
[Credentials]
language=CH
endpoint=https://$REGION.aliyuncs.com
accessKeyID=$ACCESS_KEY_ID
accessKeySecret=$ACCESS_KEY_SECRET
"@

$configContent | Out-File -FilePath ".\.ossutilconfig" -Encoding utf8 -Force

# ====== 开始上传 ======
Write-Host "📤 开始上传文件到 OSS..." -ForegroundColor Cyan
Write-Host "Bucket: $BUCKET_NAME" -ForegroundColor Gray
Write-Host "Region: $REGION" -ForegroundColor Gray
Write-Host ""

# 上传所有文件
& $ossutilPath cp -r `
    .\ `
    "oss://$BUCKET_NAME/" `
    -c .\.ossutilconfig `
    -u `
    --exclude "*.ps1" `
    --exclude "*.sh" `
    --exclude "*.md" `
    --exclude ".git/*" `
    --exclude "node_modules/*" `
    --exclude "ossutil*" `
    --exclude ".ossutilconfig"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 上传完成!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 下一步操作:" -ForegroundColor Yellow
    Write-Host "1. 在OSS控制台 -> 基础设置 -> 静态页面" -ForegroundColor White
    Write-Host "   设置默认首页: index.html" -ForegroundColor White
    Write-Host ""
    Write-Host "2. 在OSS控制台 -> 传输管理 -> 域名管理" -ForegroundColor White
    Write-Host "   绑定域名: lossloop.cn" -ForegroundColor White
    Write-Host "   ⚠️ 勾选 CDN加速（重要！）" -ForegroundColor Red
    Write-Host ""
    Write-Host "3. 配置DNS指向CDN给你的CNAME地址" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ 上传失败!" -ForegroundColor Red
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "- AccessKey是否正确" -ForegroundColor White
    Write-Host "- Bucket名称是否正确" -ForegroundColor White
    Write-Host "- 网络连接是否正常" -ForegroundColor White
    Write-Host ""
}

# 清理敏感信息
Remove-Item ".\.ossutilconfig" -Force -ErrorAction SilentlyContinue

Write-Host ""
pause

