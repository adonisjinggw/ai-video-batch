/**
 * ==================== 小卷助手语音对话系统 ====================
 * 支持 STT (语音识别) + TTS (语音合成) 完整循环
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        apiEndpoint: '/api/proxy',
        sttAction: 'speech-to-text',
        ttsActions: {
            gemini: 'gemini-tts',
            kling: 'kling-tts'
        },
        defaultVoice: 'gemini',
        recordingDuration: 30000, // 最长30秒
        silenceTimeout: 2000 // 2秒无声音自动停止
    };

    // ==================== 语音对话引擎 ====================
    class AssistantVoice {
        constructor() {
            this.mediaRecorder = null;
            this.audioChunks = [];
            this.isRecording = false;
            this.audioContext = null;
            this.analyser = null;
            this.silenceTimer = null;
            this.currentAudio = null;
        }

        /**
         * 初始化语音系统
         */
        async init() {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('[语音系统] 浏览器不支持音频录制');
                return false;
            }

            try {
                // 初始化 AudioContext
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;

                console.log('[语音系统] 初始化完成');
                return true;
            } catch (e) {
                console.error('[语音系统] 初始化失败:', e);
                return false;
            }
        }

        /**
         * 开始录音
         * @param {Function} onSoundDetected - 检测到声音时的回调
         * @param {Function} onSilence - 检测到静音时的回调
         * @param {Function} onComplete - 录音完成时的回调
         */
        async startRecording(options = {}) {
            if (this.isRecording) {
                console.warn('[语音系统] 正在录音中');
                return;
            }

            const {
                onSoundDetected = null,
                onSilence = null,
                onComplete = null,
                maxDuration = CONFIG.recordingDuration
            } = options;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                // 设置音频分析
                const source = this.audioContext.createMediaStreamSource(stream);
                source.connect(this.analyser);

                // 创建 MediaRecorder
                this.mediaRecorder = new MediaRecorder(stream, {
                    mimeType: this.getSupportedMimeType()
                });

                this.audioChunks = [];
                this.isRecording = true;
                let hasSound = false;

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = async () => {
                    this.isRecording = false;
                    this.stopSilenceDetection();

                    // 停止所有轨道
                    stream.getTracks().forEach(track => track.stop());

                    if (this.audioChunks.length > 0) {
                        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                        const audioData = await this.blobToBase64(audioBlob);

                        if (onComplete) {
                            onComplete(audioData);
                        }
                    }
                };

                this.mediaRecorder.start();

                // 启动音量检测
                this.startVolumeDetection((volume) => {
                    if (volume > 20 && !hasSound) {
                        hasSound = true;
                        if (onSoundDetected) onSoundDetected();
                    }
                });

                // 设置最大录音时长
                setTimeout(() => {
                    if (this.isRecording) {
                        this.stopRecording();
                    }
                }, maxDuration);

                console.log('[语音系统] 开始录音');
                return true;
            } catch (e) {
                console.error('[语音系统] 录音启动失败:', e);
                this.isRecording = false;
                return false;
            }
        }

        /**
         * 停止录音
         */
        stopRecording() {
            if (this.mediaRecorder && this.isRecording) {
                this.mediaRecorder.stop();
                console.log('[语音系统] 停止录音');
            }
        }

        /**
         * 启动音量检测
         */
        startVolumeDetection(callback) {
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            let silenceCount = 0;

            const detect = () => {
                if (!this.isRecording) return;

                this.analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

                callback(average);

                // 检测静音
                if (average < 10) {
                    silenceCount++;
                    if (silenceCount > 20) { // 约2秒
                        if (this.silenceTimer) clearTimeout(this.silenceTimer);
                        this.silenceTimer = setTimeout(() => {
                            this.stopRecording();
                        }, CONFIG.silenceTimeout);
                    }
                } else {
                    silenceCount = 0;
                    if (this.silenceTimer) {
                        clearTimeout(this.silenceTimer);
                        this.silenceTimer = null;
                    }
                }

                requestAnimationFrame(detect);
            };

            detect();
        }

        /**
         * 停止静音检测
         */
        stopSilenceDetection() {
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }
        }

        /**
         * 语音转文字
         * @param {string} audioData - Base64 编码的音频数据
         * @param {object} options - 选项
         */
        async speechToText(audioData, options = {}) {
            try {
                const response = await fetch(CONFIG.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: CONFIG.sttAction,
                        audio: audioData,
                        ...options
                    })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    console.log('[语音系统] 识别结果:', result.data.text);
                    return result.data.text;
                }

                throw new Error(result.error || '语音识别失败');
            } catch (e) {
                console.error('[语音系统] 语音识别失败:', e);
                throw e;
            }
        }

        /**
         * 文字转语音
         * @param {string} text - 要朗读的文本
         * @param {object} options - 选项
         */
        async textToSpeech(text, options = {}) {
            try {
                const {
                    voice = 'default',
                    model = 'pro',
                    language = 'zh-CN'
                } = options;

                const response = await fetch(CONFIG.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: CONFIG.ttsActions.gemini,
                        text,
                        voice,
                        model,
                        language
                    })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    await this.playAudio(result.data.audioUrl || result.data.url);
                    return true;
                }

                throw new Error(result.error || '语音合成失败');
            } catch (e) {
                console.error('[语音系统] 语音合成失败:', e);
                throw e;
            }
        }

        /**
         * 播放音频
         * @param {string} audioUrl - 音频URL或Base64数据
         */
        async playAudio(audioUrl) {
            return new Promise((resolve, reject) => {
                // 停止当前播放
                this.stopPlayback();

                const audio = new Audio();
                this.currentAudio = audio;

                audio.onended = () => {
                    this.currentAudio = null;
                    resolve();
                };

                audio.onerror = (e) => {
                    this.currentAudio = null;
                    reject(new Error('音频播放失败'));
                };

                audio.src = audioUrl;
                audio.play();
            });
        }

        /**
         * 停止播放
         */
        stopPlayback() {
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio = null;
            }
        }

        /**
         * 完整对话流程：录音 -> 识别 -> 返回文本
         */
        async listen(options = {}) {
            return new Promise((resolve, reject) => {
                this.startRecording({
                    ...options,
                    onComplete: async (audioData) => {
                        try {
                            const text = await this.speechToText(audioData, options);
                            resolve(text);
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            });
        }

        /**
         * 完整对话流程：文本 -> 合成 -> 播放
         */
        async speak(text, options = {}) {
            return this.textToSpeech(text, options);
        }

        /**
         * 获取支持的音频格式
         */
        getSupportedMimeType() {
            const types = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/mp4',
                'audio/mpeg'
            ];

            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    return type;
                }
            }

            return '';
        }

        /**
         * Blob 转 Base64
         */
        blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        /**
         * 获取音量水平 (0-100)
         */
        getVolumeLevel() {
            if (!this.analyser) return 0;

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            return Math.min(100, (average / 128) * 100);
        }

        /**
         * 检查是否有麦克风权限
         */
        async checkMicrophonePermission() {
            try {
                const result = await navigator.permissions.query({ name: 'microphone' });
                return result.state === 'granted';
            } catch (e) {
                // 某些浏览器不支持 permissions API
                return true;
            }
        }

        /**
         * 请求麦克风权限
         */
        async requestMicrophonePermission() {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                return true;
            } catch (e) {
                console.error('[语音系统] 麦克风权限被拒绝:', e);
                return false;
            }
        }

        /**
         * 销毁语音系统
         */
        destroy() {
            this.stopRecording();
            this.stopPlayback();
            this.stopSilenceDetection();

            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
        }
    }

    // ==================== 导出 ====================
    window.AssistantVoice = new AssistantVoice();

    // 自动初始化
    window.AssistantVoice.init();

    console.log('[语音系统] 已加载');

})();
