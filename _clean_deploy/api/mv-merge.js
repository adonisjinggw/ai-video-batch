/**
 * MV音视频合成API
 * 使用云端FFmpeg服务合并视频片段并替换音轨
 */

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { clips, audioUrl, userId } = body || {};

        // 验证必填参数
        if (!userId) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录' });
            return;
        }

        if (!clips || !Array.isArray(clips) || clips.length === 0) {
            res.status(400).json({ error: 'MISSING_CLIPS', message: '缺少视频片段' });
            return;
        }

        if (!audioUrl) {
            res.status(400).json({ error: 'MISSING_AUDIO', message: '缺少音频URL' });
            return;
        }

        console.log(`[mv-merge] 开始合成MV: ${clips.length}个片段, 音频: ${audioUrl.substring(0, 50)}...`);

        // 方案1：使用RunningHub云端FFmpeg服务
        const RH_API_KEY = process.env.RUNNINGHUB_API_KEY || '';
        const RH_BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';
        
        if (RH_API_KEY) {
            try {
                const result = await mergeWithRunningHub(clips, audioUrl, RH_API_KEY, RH_BASE_URL);
                res.status(200).json({
                    success: true,
                    videoUrl: result.videoUrl,
                    method: 'runninghub'
                });
                return;
            } catch (e) {
                console.warn('[mv-merge] RunningHub合成失败，尝试备用方案:', e.message);
            }
        }

        // 方案2：使用第三方视频合成API（如Creatomate、Shotstack等）
        // 这里提供一个简化的实现，实际需要根据具体服务调整
        
        // 方案3：返回片段列表，让前端使用FFmpeg.wasm合成
        res.status(200).json({
            success: true,
            videoUrl: null,
            clips: clips,
            audioUrl: audioUrl,
            method: 'client-side',
            message: '请在客户端使用FFmpeg.wasm合成'
        });

    } catch (error) {
        console.error('[mv-merge] 错误:', error);
        res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
    }
};

/**
 * 使用RunningHub云端服务合成视频
 */
async function mergeWithRunningHub(clips, audioUrl, apiKey, baseUrl) {
    // 1. 上传所有视频片段
    const uploadedFiles = [];
    for (const clipUrl of clips) {
        const fileName = await uploadFileToRH(clipUrl, apiKey, baseUrl, 'video');
        uploadedFiles.push(fileName);
    }
    
    // 2. 上传音频
    const audioFileName = await uploadFileToRH(audioUrl, apiKey, baseUrl, 'audio');
    
    // 3. 调用合成任务
    // 注意：这需要RunningHub有对应的视频合成工作流
    // 这里是示例代码，实际需要根据RunningHub的API调整
    
    throw new Error('RunningHub视频合成工作流未配置');
}

/**
 * 上传文件到RunningHub
 */
async function uploadFileToRH(fileUrl, apiKey, baseUrl, fileType) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || (fileType === 'audio' ? 'audio/mpeg' : 'video/mp4');
    const arrayBuffer = await response.arrayBuffer();
    
    const filename = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileType === 'audio' ? 'mp3' : 'mp4'}`;
    
    const form = new FormData();
    form.append('apiKey', apiKey);
    form.append('fileType', fileType);
    form.append('file', new Blob([arrayBuffer], { type: contentType }), filename);
    
    const uploadRes = await fetch(`${baseUrl}/task/openapi/upload`, {
        method: 'POST',
        body: form
    });
    
    if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`上传失败: ${uploadRes.status} ${text}`);
    }
    
    const result = await uploadRes.json();
    if (result.code !== 0) {
        throw new Error(`上传失败: ${result.msg}`);
    }
    
    return result.data?.fileName;
}
