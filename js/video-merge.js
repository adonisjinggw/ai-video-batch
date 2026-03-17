/**
 * 🎬 video-merge.js — 客户端视频合并工具
 * 功能：将多段视频URL合并为一个完整视频（Canvas + MediaRecorder）
 * 
 * 原理：
 * 1. 依次加载每段视频到隐藏 <video> 元素
 * 2. 用 Canvas 逐帧绘制
 * 3. MediaRecorder 录制 Canvas 流
 * 4. 所有片段播完后输出合并的 Blob
 * 
 * 用法：
 *   VideoMerger.merge(['url1','url2'], { onProgress, onComplete, onError })
 *   VideoMerger.mergeAndDownload(['url1','url2'], 'output.mp4', onProgress)
 */

var VideoMerger = (function () {
    'use strict';

    // 检测浏览器支持
    function isSupported() {
        return typeof MediaRecorder !== 'undefined' &&
            typeof HTMLCanvasElement !== 'undefined' &&
            HTMLCanvasElement.prototype.captureStream;
    }

    // MIME 类型优先级
    function getPreferredMime() {
        var mimes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
        for (var i = 0; i < mimes.length; i++) {
            if (MediaRecorder.isTypeSupported(mimes[i])) return mimes[i];
        }
        return 'video/webm';
    }

    // 加载视频元数据
    function loadVideo(url) {
        return new Promise(function (resolve, reject) {
            var video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.preload = 'auto';
            video.muted = true; // 先静音以绕过自动播放限制
            video.playsInline = true;
            video.style.display = 'none';

            video.onloadedmetadata = function () { resolve(video); };
            video.onerror = function () { reject(new Error('视频加载失败: ' + url)); };

            // 超时处理
            var timer = setTimeout(function () {
                reject(new Error('视频加载超时: ' + url));
            }, 30000);

            video.onloadedmetadata = function () {
                clearTimeout(timer);
                resolve(video);
            };

            video.src = url;
            video.load();
        });
    }

    // 在 Canvas 上播放单个视频片段
    function playSegmentOnCanvas(video, canvas, ctx) {
        return new Promise(function (resolve) {
            video.muted = false; // 恢复音频
            video.currentTime = 0;

            function drawFrame() {
                if (video.paused || video.ended) return;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(drawFrame);
            }

            video.onended = function () {
                // 绘制最后一帧确保不丢失
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve();
            };

            video.play().then(function () {
                drawFrame();
            }).catch(function () {
                // 自动播放被阻止，尝试静音播放
                video.muted = true;
                video.play().then(function () {
                    drawFrame();
                }).catch(function (e) {
                    console.error('[VideoMerger] 播放失败:', e);
                    resolve(); // 跳过此片段
                });
            });
        });
    }

    /**
     * 合并多段视频
     * @param {string[]} urls - 视频URL数组
     * @param {Object} opts
     * @param {Function} opts.onProgress - (current, total, message) 进度回调
     * @param {number} opts.width - 输出宽度（默认自动检测）
     * @param {number} opts.height - 输出高度（默认自动检测）
     * @param {number} opts.videoBitsPerSecond - 码率（默认5Mbps）
     * @returns {Promise<Blob>} 合并后的视频 Blob
     */
    async function merge(urls, opts) {
        opts = opts || {};
        var onProgress = opts.onProgress || function () { };

        if (!isSupported()) {
            throw new Error('当前浏览器不支持视频合并（需要 MediaRecorder + Canvas）');
        }

        if (!urls || urls.length === 0) {
            throw new Error('没有可合并的视频');
        }

        if (urls.length === 1) {
            // 单个视频直接下载
            onProgress(1, 1, '单个视频，直接下载...');
            var resp = await fetch(urls[0]);
            return await resp.blob();
        }

        onProgress(0, urls.length, '正在加载视频...');

        // 1. 预加载所有视频获取元数据
        var videos = [];
        for (var i = 0; i < urls.length; i++) {
            onProgress(i, urls.length, '加载视频 ' + (i + 1) + '/' + urls.length + '...');
            try {
                var v = await loadVideo(urls[i]);
                videos.push(v);
            } catch (e) {
                console.warn('[VideoMerger] 跳过加载失败的视频:', e.message);
            }
        }

        if (videos.length === 0) {
            throw new Error('所有视频加载失败');
        }

        // 2. 确定输出尺寸（取第一个视频的尺寸或用户指定）
        var width = opts.width || videos[0].videoWidth || 1280;
        var height = opts.height || videos[0].videoHeight || 720;

        // 3. 创建 Canvas
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');

        // 4. 创建 MediaRecorder
        var mimeType = getPreferredMime();
        var stream = canvas.captureStream(30); // 30fps

        // 尝试捕获音频（如果视频有声音）
        // 注意：Canvas captureStream 不包含音频，需要用 AudioContext 混合
        // 简化版先只合并画面，后续可扩展音频合并

        var chunks = [];
        var recorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: opts.videoBitsPerSecond || 5000000
        });

        recorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        var recorderDone = new Promise(function (resolve) {
            recorder.onstop = function () {
                resolve(new Blob(chunks, { type: mimeType }));
            };
        });

        recorder.start(100); // 每100ms输出一个chunk

        // 5. 依次播放每段视频到 Canvas
        for (var j = 0; j < videos.length; j++) {
            onProgress(j + 1, videos.length, '合并视频 ' + (j + 1) + '/' + videos.length + '...');
            await playSegmentOnCanvas(videos[j], canvas, ctx);
        }

        // 6. 停止录制
        recorder.stop();
        onProgress(videos.length, videos.length, '正在生成合并视频...');

        var blob = await recorderDone;

        // 7. 清理
        videos.forEach(function (v) {
            v.pause();
            v.src = '';
            v.load();
        });

        onProgress(videos.length, videos.length, '✅ 合并完成');
        return blob;
    }

    /**
     * 合并并下载
     * @param {string[]} urls - 视频URL数组
     * @param {string} filename - 输出文件名
     * @param {Function} onProgress - 进度回调
     */
    async function mergeAndDownload(urls, filename, onProgress) {
        var blob = await merge(urls, { onProgress: onProgress });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || ('merged_video_' + Date.now() + '.webm');
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        }, 1000);
        return blob;
    }

    /**
     * 创建合并按钮（插入到容器中）
     * @param {string[]} videoUrls - 视频URL数组
     * @param {HTMLElement} container - 插入目标容器
     * @param {string} label - 按钮文字
     */
    function createMergeButton(videoUrls, container, label) {
        if (!videoUrls || videoUrls.length < 2) return null;
        if (!isSupported()) return null;

        var wrapper = document.createElement('div');
        wrapper.className = 'video-merge-bar';
        wrapper.style.cssText = 'margin-top:10px;padding:10px 12px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.3);border-radius:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        var info = document.createElement('span');
        info.style.cssText = 'font-size:12px;color:#a5b4fc;flex:1;';
        info.textContent = '🎬 共 ' + videoUrls.length + ' 段视频，可合并为完整视频';

        var progressText = document.createElement('span');
        progressText.style.cssText = 'font-size:11px;color:#818cf8;display:none;';

        var btn = document.createElement('button');
        btn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid rgba(99,102,241,0.5);background:linear-gradient(135deg,rgba(99,102,241,0.3),rgba(99,102,241,0.1));color:#a5b4fc;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.2s;';
        btn.textContent = label || '🔗 合并为完整视频';
        btn.onmouseover = function () { btn.style.background = 'linear-gradient(135deg,rgba(99,102,241,0.5),rgba(99,102,241,0.2))'; };
        btn.onmouseout = function () { btn.style.background = 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(99,102,241,0.1))'; };

        btn.onclick = async function () {
            btn.disabled = true;
            btn.textContent = '⏳ 合并中...';
            btn.style.opacity = '0.6';
            progressText.style.display = '';

            try {
                await mergeAndDownload(videoUrls, 'merged_video_' + Date.now() + '.webm', function (current, total, msg) {
                    progressText.textContent = msg;
                });
                btn.textContent = '✅ 合并完成，已下载';
                btn.style.borderColor = 'rgba(34,197,94,0.5)';
                btn.style.color = '#4ade80';
                if (typeof showToast === 'function') showToast('✅ 视频合并完成，已开始下载');
            } catch (e) {
                btn.textContent = '❌ 合并失败，点击重试';
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.borderColor = 'rgba(239,68,68,0.5)';
                btn.style.color = '#f87171';
                progressText.textContent = e.message;
                if (typeof showToast === 'function') showToast('合并失败: ' + e.message, 'error');
            }
        };

        // 连续播放按钮
        var playBtn = document.createElement('button');
        playBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid rgba(251,191,36,0.4);background:linear-gradient(135deg,rgba(251,191,36,0.2),rgba(251,191,36,0.05));color:#fbbf24;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.2s;';
        playBtn.textContent = '▶️ 连续播放';
        playBtn.onclick = function () {
            playSequentially(videoUrls, container);
        };

        wrapper.appendChild(info);
        wrapper.appendChild(playBtn);
        wrapper.appendChild(btn);
        wrapper.appendChild(progressText);

        if (container) container.appendChild(wrapper);
        return wrapper;
    }

    /**
     * 连续播放多段视频（在页面内创建播放器）
     * @param {string[]} urls
     * @param {HTMLElement} nearElement - 在此元素附近创建播放器
     */
    function playSequentially(urls, nearElement) {
        if (!urls || urls.length === 0) return;

        // 移除已有的播放器
        var existing = document.getElementById('_videoMergePlayer');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = '_videoMergePlayer';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;';

        var header = document.createElement('div');
        header.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:2;';

        var title = document.createElement('span');
        title.style.cssText = 'color:#a5b4fc;font-size:14px;font-weight:600;';
        title.textContent = '▶️ 连续播放 1/' + urls.length;

        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:#333;border:none;color:#ccc;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;';
        closeBtn.textContent = '✕ 关闭';
        closeBtn.onclick = function () { overlay.remove(); };

        header.appendChild(title);
        header.appendChild(closeBtn);

        var video = document.createElement('video');
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.style.cssText = 'max-width:95%;max-height:85vh;border-radius:8px;';

        var idx = 0;
        function playNext() {
            if (idx >= urls.length) {
                title.textContent = '✅ 全部播放完成';
                return;
            }
            title.textContent = '▶️ 连续播放 ' + (idx + 1) + '/' + urls.length;
            video.src = urls[idx];
            video.play().catch(function () { });
            idx++;
        }

        video.onended = playNext;
        overlay.appendChild(header);
        overlay.appendChild(video);
        document.body.appendChild(overlay);

        // 开始播放第一段
        playNext();

        // ESC 关闭
        var escHandler = function (e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 导出
    return {
        isSupported: isSupported,
        merge: merge,
        mergeAndDownload: mergeAndDownload,
        createMergeButton: createMergeButton,
        playSequentially: playSequentially
    };
})();
