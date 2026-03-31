/**
 * ==================== 小卷助手 AIRI 风格 Stage UI ====================
 * 参考 AIRI 项目的 Stage UI 设计
 * - 浮动对话气泡
 * - 3D 角色舞台
 * - 语音波形可视化
 * - 情绪表达系统
 *
 * 注意：这是对旧版助手的增强，不会替换原有功能
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // Stage 位置
        stagePosition: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
        // 角色大小
        characterSize: 200,
        // 气泡样式
        bubbleMaxWidth: 320,
        bubbleAnimationDuration: 300,
        // 音频可视化
        audioVisualizerBars: 16,
        audioVisualizerMaxHeight: 40,
        // 是否启用（VRM加载成功后才启用）
        enabled: false
    };

    // ==================== Stage UI 管理器 ====================
    class AssistantStageUI {
        constructor() {
            this.stageElement = null;
            this.characterCanvas = null;
            this.dialogueBubble = null;
            this.visualizerBars = [];
            this.currentEmotion = 'neutral';
            this.isSpeaking = false;
            this.dialogueQueue = [];
            this.currentDialogue = null;
            this.isInitialized = false;
        }

        /**
         * 初始化 Stage UI（仅在启用时创建）
         */
        init() {
            if (this.isInitialized || !CONFIG.enabled) return;

            this.createStage();
            this.createCharacterCanvas();
            this.createDialogueBubble();
            this.createAudioVisualizer();
            this.setupEventListeners();
            this.applyPosition();

            this.isInitialized = true;
            console.log('[Stage UI] 初始化完成');
        }

        /**
         * 启用 Stage UI（VRM 加载成功后调用）
         */
        enable() {
            CONFIG.enabled = true;
            this.init();
        }

        /**
         * 创建舞台容器
         */
        createStage() {
            this.stageElement = document.createElement('div');
            this.stageElement.id = 'assistant-stage';
            this.stageElement.className = 'assistant-stage';

            document.body.appendChild(this.stageElement);
        }

        /**
         * 创建角色 Canvas（用于 VRM 模型渲染）
         */
        createCharacterCanvas() {
            const characterContainer = document.createElement('div');
            characterContainer.className = 'assistant-character-container';

            this.characterCanvas = document.createElement('canvas');
            this.characterCanvas.id = 'assistant-character-canvas';
            this.characterCanvas.className = 'assistant-character-canvas';
            this.characterCanvas.width = CONFIG.characterSize;
            this.characterCanvas.height = CONFIG.characterSize;

            // 加载指示器
            this.loaderElement = document.createElement('div');
            this.loaderElement.className = 'assistant-character-loader';
            this.loaderElement.innerHTML = `
                <div class="loader-spinner"></div>
                <div class="loader-text">加载角色中...</div>
            `;

            characterContainer.appendChild(this.characterCanvas);
            characterContainer.appendChild(this.loaderElement);
            this.stageElement.appendChild(characterContainer);

            // 默认隐藏加载器
            this.loaderElement.style.display = 'none';
        }

        /**
         * 显示加载器
         */
        showLoader() {
            if (this.loaderElement) {
                this.loaderElement.style.display = 'flex';
            }
        }

        /**
         * 隐藏加载器
         */
        hideLoader() {
            if (this.loaderElement) {
                this.loaderElement.style.display = 'none';
            }
        }

        /**
         * 创建对话气泡（独立于旧版气泡）
         */
        createDialogueBubble() {
            this.dialogueBubble = document.createElement('div');
            this.dialogueBubble.className = 'assistant-dialogue-bubble';
            this.dialogueBubble.innerHTML = `
                <div class="dialogue-bubble-inner">
                    <div class="dialogue-bubble-content"></div>
                    <div class="dialogue-bubble-tail"></div>
                </div>
                <div class="dialogue-emotion-indicator"></div>
            `;

            this.stageElement.appendChild(this.dialogueBubble);
        }

        /**
         * 创建音频可视化器
         */
        createAudioVisualizer() {
            const visualizer = document.createElement('div');
            visualizer.className = 'assistant-audio-visualizer';

            for (let i = 0; i < CONFIG.audioVisualizerBars; i++) {
                const bar = document.createElement('div');
                bar.className = 'visualizer-bar';
                bar.style.height = '4px';
                this.visualizerBars.push(bar);
                visualizer.appendChild(bar);
            }

            this.stageElement.appendChild(visualizer);
        }

        /**
         * 设置事件监听
         */
        setupEventListeners() {
            // 鼠标移动 - 视线跟踪
            document.addEventListener('mousemove', (e) => {
                if (window.AssistantVRM && window.AssistantVRM.isLoaded) {
                    window.AssistantVRM.followMouse(e.clientX, e.clientY);
                }
            });

            // 窗口大小改变
            window.addEventListener('resize', () => {
                if (window.AssistantVRM) {
                    const canvas = this.characterCanvas;
                    window.AssistantVRM.resize(canvas.clientWidth, canvas.clientHeight);
                }
            });

            // 触摸事件 - 移动端
            document.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0 && window.AssistantVRM && window.AssistantVRM.isLoaded) {
                    window.AssistantVRM.followMouse(
                        e.touches[0].clientX,
                        e.touches[0].clientY
                    );
                }
            }, { passive: true });

            // 点击气泡展开对话面板（连接旧版功能）
            this.dialogueBubble.addEventListener('click', () => {
                if (window.toggleAssistantPanel) {
                    window.toggleAssistantPanel();
                }
            });
        }

        /**
         * 应用位置设置
         */
        applyPosition() {
            const positionClass = `stage-${CONFIG.stagePosition}`;
            this.stageElement.classList.add(positionClass);
        }

        /**
         * 显示对话（仅在 Stage UI 启用时使用）
         */
        showDialogue(message, options = {}) {
            if (!this.isInitialized) return;

            const {
                emotion = 'neutral',
                duration = 4000,
                typing = true
            } = options;

            const content = this.dialogueBubble.querySelector('.dialogue-bubble-content');
            const emotionIndicator = this.dialogueBubble.querySelector('.dialogue-emotion-indicator');

            // 设置情绪
            this.setEmotion(emotion);

            // 显示气泡
            this.dialogueBubble.classList.add('show');

            if (typing) {
                // 打字机效果
                this.typeWriter(content, message);
            } else {
                content.textContent = message;
            }

            // 设置情绪指示器
            emotionIndicator.className = `dialogue-emotion-indicator emotion-${emotion}`;

            // 自动隐藏
            if (this.dialogueTimer) clearTimeout(this.dialogueTimer);
            this.dialogueTimer = setTimeout(() => {
                this.hideDialogue();
            }, duration);
        }

        /**
         * 打字机效果
         */
        typeWriter(element, text, index = 0) {
            if (index === 0) {
                element.textContent = '';
            }

            if (index < text.length) {
                element.textContent += text.charAt(index);
                this.dialogueTimer = setTimeout(() => {
                    this.typeWriter(element, text, index + 1);
                }, 30);
            }
        }

        /**
         * 隐藏对话气泡
         */
        hideDialogue() {
            if (this.dialogueBubble) {
                this.dialogueBubble.classList.remove('show');
            }
        }

        /**
         * 设置情绪
         */
        setEmotion(emotion) {
            this.currentEmotion = emotion;

            // 更新 VRM 模型表情
            if (window.AssistantVRM && window.AssistantVRM.isLoaded) {
                window.AssistantVRM.playEmotion(emotion);
            }

            // 更新气泡样式
            if (this.dialogueBubble) {
                this.dialogueBubble.setAttribute('data-emotion', emotion);
            }
        }

        /**
         * 开始说话（音频可视化）
         */
        startSpeaking() {
            this.isSpeaking = true;

            // VRM 说话动画
            if (window.AssistantVRM && window.AssistantVRM.isLoaded) {
                window.AssistantVRM.startSpeaking();
            }

            // 启动音频可视化动画
            this.animateVisualizer();
        }

        /**
         * 停止说话
         */
        stopSpeaking() {
            this.isSpeaking = false;

            // VRM 停止说话动画
            if (window.AssistantVRM && window.AssistantVRM.isLoaded) {
                window.AssistantVRM.stopSpeaking();
            }

            // 重置音频可视化
            this.visualizerBars.forEach(bar => {
                bar.style.height = '4px';
            });
        }

        /**
         * 音频可视化动画
         */
        animateVisualizer() {
            if (!this.isSpeaking) return;

            this.visualizerBars.forEach(bar => {
                const height = 4 + Math.random() * CONFIG.audioVisualizerMaxHeight;
                bar.style.height = `${height}px`;
            });

            requestAnimationFrame(() => {
                setTimeout(() => this.animateVisualizer(), 50);
            });
        }

        /**
         * 设置角色大小
         */
        setCharacterSize(size) {
            CONFIG.characterSize = size;
            if (this.characterCanvas) {
                this.characterCanvas.style.width = `${size}px`;
                this.characterCanvas.style.height = `${size}px`;
            }
        }

        /**
         * 移除舞台
         */
        destroy() {
            if (this.stageElement && this.stageElement.parentNode) {
                this.stageElement.parentNode.removeChild(this.stageElement);
            }

            if (window.AssistantVRM) {
                window.AssistantVRM.dispose();
            }

            this.isInitialized = false;
            CONFIG.enabled = false;
        }
    }

    // ==================== 导出 ====================
    window.AssistantStageUI = new AssistantStageUI();

    // 注意：不再自动初始化，等待 VRM 加载成功后手动调用 init()
    console.log('[Stage UI] 已加载（等待 VRM 激活）');

})();
