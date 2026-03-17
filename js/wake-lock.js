/**
 * 🔒 wake-lock.js — 防息屏 / 后台保活工具
 * 使用 Screen Wake Lock API 防止手机息屏导致任务中断
 * 降级方案：无声音频 + 隐藏视频循环保活
 */
var WakeLockUtil = (function () {
    var _wakeLock = null;
    var _fallbackVideo = null;
    var _keepAliveTimer = null;
    var _active = false;

    // 请求 Wake Lock（主方案）
    async function _requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                _wakeLock = await navigator.wakeLock.request('screen');
                _wakeLock.addEventListener('release', function () {
                    console.log('[WakeLock] 已释放');
                    // 如果任务仍在执行，尝试重新获取
                    if (_active) {
                        console.log('[WakeLock] 任务仍在执行，尝试重新获取...');
                        setTimeout(function () { if (_active) _requestWakeLock(); }, 1000);
                    }
                });
                console.log('[WakeLock] Screen Wake Lock 已激活');
                return true;
            } catch (e) {
                console.warn('[WakeLock] Screen Wake Lock 获取失败:', e.message);
            }
        }
        return false;
    }

    // 降级方案：无声视频循环（防止浏览器挂起页面）
    function _startFallback() {
        if (_fallbackVideo) return;
        try {
            // 创建极小的无声视频元素
            _fallbackVideo = document.createElement('video');
            _fallbackVideo.setAttribute('playsinline', '');
            _fallbackVideo.setAttribute('muted', '');
            _fallbackVideo.muted = true;
            _fallbackVideo.loop = true;
            _fallbackVideo.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
            // 最小有效视频（1x1 黑色 webm，base64）
            _fallbackVideo.src = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0CG' +
                'Q2hyb21lFlSua7+uvdeBAXPFh4EBYQ==';
            document.body.appendChild(_fallbackVideo);
            _fallbackVideo.play().catch(function () { });
            console.log('[WakeLock] 降级方案：无声视频保活已启动');
        } catch (e) {
            console.warn('[WakeLock] 降级方案启动失败:', e.message);
        }

        // 定时 keepalive fetch（防止 Service Worker 休眠）
        if (!_keepAliveTimer) {
            _keepAliveTimer = setInterval(function () {
                if (!_active) return;
                fetch('/api/supabase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'ping' }),
                    keepalive: true
                }).catch(function () { });
            }, 25000); // 每25秒ping一次
        }
    }

    function _stopFallback() {
        if (_fallbackVideo) {
            _fallbackVideo.pause();
            _fallbackVideo.remove();
            _fallbackVideo = null;
        }
        if (_keepAliveTimer) {
            clearInterval(_keepAliveTimer);
            _keepAliveTimer = null;
        }
    }

    // 页面可见性变化时重新获取 Wake Lock
    function _onVisibilityChange() {
        if (document.visibilityState === 'visible' && _active) {
            _requestWakeLock();
        }
    }

    return {
        /**
         * 开始保活（在长任务开始时调用）
         */
        acquire: async function () {
            if (_active) return;
            _active = true;
            var got = await _requestWakeLock();
            if (!got) _startFallback();
            // 双保险：同时启动降级方案
            _startFallback();
            document.addEventListener('visibilitychange', _onVisibilityChange);
            console.log('[WakeLock] 保活模式已开启');
        },

        /**
         * 停止保活（在任务完成/暂停时调用）
         */
        release: function () {
            _active = false;
            if (_wakeLock) {
                _wakeLock.release().catch(function () { });
                _wakeLock = null;
            }
            _stopFallback();
            document.removeEventListener('visibilitychange', _onVisibilityChange);
            console.log('[WakeLock] 保活模式已关闭');
        },

        /** 当前是否活跃 */
        isActive: function () { return _active; }
    };
})();
