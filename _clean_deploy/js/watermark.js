/**
 * 🔒 水印系统 - rollroll.art
 * - 所有生成的图片/视频默认显示水印
 * - 付费用户(VIP)自动去除水印
 * - 显示水印：CSS 半透明覆盖层（防截图）
 * - 下载水印：Canvas 烧录到像素（防下载绕过）
 */
(function (global) {
    'use strict';

    const WATERMARK_TEXT = 'rollroll.art';

    // ==================== VIP 检查 ====================
    function _isVipUser() {
        // 优先用全局 isVip()（batch.js 定义）
        if (typeof isVip === 'function') {
            try { return isVip(); } catch (e) { }
        }
        // 自行检查 localStorage
        const memberType = localStorage.getItem('membership_type');
        if (memberType && memberType !== 'free') return true;
        const vipInfo = localStorage.getItem('vip_info');
        if (!vipInfo) return false;
        try {
            const info = JSON.parse(vipInfo);
            if (!info.expiry) return true;
            return new Date(info.expiry) > new Date();
        } catch (e) { return false; }
    }

    /** 是否需要显示水印 */
    function shouldApply() {
        return !_isVipUser();
    }

    // ==================== CSS 水印覆盖层 ====================

    // 生成 SVG 水印图案（平铺斜排文字）
    function _buildWatermarkSVG() {
        const text = WATERMARK_TEXT;
        // SVG tile: 斜排文字
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120">
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                  font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold"
                  fill="rgba(255,255,255,0.18)" transform="rotate(-28, 110, 60)">${text}</text>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }

    let _svgUrl = null;
    function _getSVG() {
        if (!_svgUrl) _svgUrl = _buildWatermarkSVG();
        return _svgUrl;
    }

    // 注入全局 CSS（只注入一次）
    let _cssInjected = false;
    function _injectCSS() {
        if (_cssInjected) return;
        _cssInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .wm-container {
                position: relative;
                display: inline-block;
                overflow: hidden;
            }
            .wm-container > img,
            .wm-container > video {
                display: block;
                width: 100%;
            }
            .wm-overlay {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 5;
                background: url("${_getSVG()}") repeat;
                background-size: 220px 120px;
            }
            /* VIP 徽章提示 */
            .wm-badge {
                position: absolute;
                bottom: 6px;
                right: 8px;
                font-size: 10px;
                color: rgba(255,255,255,0.35);
                z-index: 6;
                pointer-events: none;
                font-family: Arial, sans-serif;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 包裹图片 HTML，添加水印覆盖层
     * @param {string} imgHtml - 原始 <img> HTML
     * @returns {string} 带水印容器的 HTML
     */
    function wrapImage(imgHtml) {
        if (!shouldApply()) return imgHtml;
        _injectCSS();
        return `<div class="wm-container">${imgHtml}<div class="wm-overlay"></div><div class="wm-badge">👑 开通会员去水印</div></div>`;
    }

    /**
     * 包裹视频 HTML，添加水印覆盖层
     * @param {string} videoHtml - 原始 <video> HTML
     * @returns {string} 带水印容器的 HTML
     */
    function wrapVideo(videoHtml) {
        if (!shouldApply()) return videoHtml;
        _injectCSS();
        return `<div class="wm-container">${videoHtml}<div class="wm-overlay"></div><div class="wm-badge">👑 开通会员去水印</div></div>`;
    }

    // ==================== Canvas 水印（下载用） ====================

    /**
     * 给图片 URL 烧录水印，返回带水印的 Blob URL
     * @param {string} imageUrl - 原图 URL
     * @returns {Promise<string>} 带水印的 Blob URL（VIP 则返回原图）
     */
    function burnWatermark(imageUrl) {
        if (!shouldApply()) return Promise.resolve(imageUrl);

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');

                    // 1. 绘制原图
                    ctx.drawImage(img, 0, 0);

                    // 2. 平铺水印文字（斜排）
                    ctx.save();
                    const fontSize = Math.max(16, Math.min(img.width, img.height) / 18);
                    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // 旋转坐标系后平铺
                    ctx.translate(img.width / 2, img.height / 2);
                    ctx.rotate(-28 * Math.PI / 180);

                    const stepX = fontSize * 12;
                    const stepY = fontSize * 5;
                    const diag = Math.sqrt(img.width * img.width + img.height * img.height);

                    for (let y = -diag; y < diag; y += stepY) {
                        for (let x = -diag; x < diag; x += stepX) {
                            ctx.fillText(WATERMARK_TEXT, x, y);
                        }
                    }
                    ctx.restore();

                    // 3. 输出
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(URL.createObjectURL(blob));
                        } else {
                            resolve(imageUrl); // fallback
                        }
                    }, 'image/png');
                } catch (e) {
                    console.warn('[Watermark] Canvas 水印失败:', e.message);
                    resolve(imageUrl);
                }
            };
            img.onerror = () => {
                // 跨域或加载失败，返回原图
                resolve(imageUrl);
            };
            img.src = imageUrl;
        });
    }

    // ==================== 导出 ====================
    const Watermark = {
        TEXT: WATERMARK_TEXT,
        shouldApply,
        wrapImage,
        wrapVideo,
        burnWatermark,
        isVipUser: _isVipUser
    };

    global.Watermark = Watermark;
    console.log('🔒 [Watermark] 水印模块已加载');

})(typeof window !== 'undefined' ? window : this);
