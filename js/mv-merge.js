/**
 * 🎬 MV 音视频合成模块
 * 使用 FFmpeg.wasm 在浏览器端将多个视频片段 + 音乐合成为一个完整 MV
 * 独立于 batch.js，可在 mobile.html 等页面单独加载
 */

window.mergeMVWithAudio = async function (videoUrls, audioUrl, onProgress) {
    const progressCallback = onProgress || ((p, m) => console.log(`[MV合成] ${p}% - ${m}`));
    console.log(`[MV合成] 开始: ${videoUrls.length}个视频 + 音频`);

    if (!videoUrls || videoUrls.length === 0) throw new Error('没有视频片段');
    if (!audioUrl) throw new Error('没有音频URL');

    // 确保 FFmpeg 已加载
    if (!window.FFmpegLoaded) {
        try {
            const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10');
            const { fetchFile, toBlobURL } = await import('https://esm.sh/@ffmpeg/util@0.12.1');
            window.FFmpegClass = FFmpeg;
            window.fetchFile = fetchFile;
            window.toBlobURL = toBlobURL;
            window.FFmpegLoaded = true;
        } catch (e) {
            throw new Error('FFmpeg库加载失败: ' + e.message);
        }
    }

    const FFmpeg = window.FFmpegClass;
    const fetchFile = window.fetchFile;
    const toBlobURL = window.toBlobURL;
    if (!FFmpeg || !fetchFile) throw new Error('FFmpeg库不可用');

    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[MV-FFmpeg]', message));
    ffmpeg.on('progress', ({ progress }) => {
        if (progress > 0) progressCallback(60 + Math.round(progress * 30), '🔧 合成中...');
    });

    // 加载 FFmpeg core
    progressCallback(5, '📦 加载合成引擎...');
    const coreBases = [
        'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        'https://npm.elemecdn.com/@ffmpeg/core@0.12.6/dist/esm',
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    ];
    if (!window.__ffmpegCoreBlobUrls) {
        for (const base of coreBases) {
            try {
                window.__ffmpegCoreBlobUrls = {
                    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
                    workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript')
                };
                break;
            } catch (e) { console.warn('CDN失败:', base, e.message); }
        }
    }
    if (!window.__ffmpegCoreBlobUrls) throw new Error('FFmpeg core下载失败');
    await ffmpeg.load(window.__ffmpegCoreBlobUrls);

    // 下载视频片段
    const inputFiles = [];
    for (let i = 0; i < videoUrls.length; i++) {
        progressCallback(10 + Math.round((i / videoUrls.length) * 30), `📥 下载视频 ${i + 1}/${videoUrls.length}...`);
        const fileName = `clip${i}.mp4`;
        try {
            let data;
            try { data = await fetchFile(videoUrls[i]); }
            catch (e) { data = await fetchFile(`https://corsproxy.io/?${encodeURIComponent(videoUrls[i])}`); }
            await ffmpeg.writeFile(fileName, data);
            inputFiles.push(fileName);
        } catch (e) {
            console.warn(`[MV合成] 视频${i + 1}下载失败:`, e.message);
        }
    }
    if (inputFiles.length === 0) throw new Error('所有视频片段下载失败');

    // 下载音频
    progressCallback(45, '📥 下载音乐...');
    try {
        let audioData;
        try { audioData = await fetchFile(audioUrl); }
        catch (e) { audioData = await fetchFile(`https://corsproxy.io/?${encodeURIComponent(audioUrl)}`); }
        await ffmpeg.writeFile('audio.mp3', audioData);
    } catch (e) {
        throw new Error('音频下载失败: ' + e.message);
    }

    // 拼接视频
    progressCallback(50, '🔧 拼接视频片段...');
    const concatList = inputFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'video_only.mp4']);

    // 合成：视频 + 音频 → 最终MV
    // -shortest: 以较短的流为准（如果音频比视频长，截断音频）
    progressCallback(60, '🎬 合成音视频...');
    await ffmpeg.exec([
        '-i', 'video_only.mp4',
        '-i', 'audio.mp3',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        '-movflags', '+faststart',
        'mv_final.mp4'
    ]);

    progressCallback(92, '✅ 合成完成，导出文件...');
    const outputData = await ffmpeg.readFile('mv_final.mp4');
    const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    // 清理
    for (const f of [...inputFiles, 'concat.txt', 'video_only.mp4', 'audio.mp3', 'mv_final.mp4']) {
        try { await ffmpeg.deleteFile(f); } catch (e) { }
    }

    progressCallback(100, '🎉 MV合成完成！');
    console.log(`[MV合成] 完成，大小: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
    return { blob, url };
};
