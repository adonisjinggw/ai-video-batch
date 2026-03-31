/**
 * ==================== 小卷助手 AIRI 风格增强 ====================
 * 纯前端实现，无需外部依赖
 * - 浮动对话气泡（带情绪）
 * - 动画头像（SVG）
 * - 语音波形可视化
 * - 状态指示器
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 情绪颜色
        emotions: {
            neutral: { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '😊' },
            happy: { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '😄' },
            sad: { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', emoji: '😢' },
            angry: { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', emoji: '😠' },
            surprised: { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', emoji: '😲' },
            thinking: { gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', emoji: '🤔' }
        },
        // 动画设置
        floatAnimation: true,
        blinkInterval: 4000,
        speakingBars: 8
    };

    // ==================== AIRI 风格增强管理器 ====================
    class AssistantAiriEnhancement {
        constructor() {
            this.container = null;
            this.avatarBtn = null;
            this.statusIndicator = null;
            this.dialogueBubble = null;
            this.visualizerBars = [];
            this.currentEmotion = 'neutral';
            this.isBlinking = false;
            this.isSpeaking = false;
            this.blinkTimer = null;
            this.speakingAnimation = null;
            this.isActive = false;
        }

        /**
         * 初始化 AIRI 增强效果
         */
        init() {
            if (this.isActive) return;

            // 获取现有的 assistant-container
            const existingContainer = document.getElementById('assistantContainer');
            if (!existingContainer) {
                console.warn('[AIRI] 助手容器未找到');
                return;
            }

            this.container = existingContainer;
            this.enhanceAvatarButton();
            this.createStatusIndicator();
            this.createDialogueBubble();
            this.createVisualizer();
            this.startBlinkAnimation();

            this.isActive = true;
            console.log('[AIRI] 增强效果已启用');
        }

        /**
         * 增强头像按钮（添加动画效果）
         */
        enhanceAvatarButton() {
            this.avatarBtn = this.container.querySelector('.assistant-avatar-btn');
            if (!this.avatarBtn) return;

            // 添加浮动动画类
            this.avatarBtn.classList.add('airi-enhanced');

            // 增强内部 SVG，添加表情变化能力
            const inner = this.avatarBtn.querySelector('.assistant-avatar-inner');
            if (inner) {
                inner.classList.add('airi-animated');
            }

            // 添加点击波纹效果
            this.avatarBtn.addEventListener('click', (e) => {
                this.createRipple(e);
            });
        }

        /**
         * 创建点击波纹效果
         */
        createRipple(event) {
            const button = event.currentTarget;
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);

            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
            ripple.classList.add('airi-ripple');

            const existingRipple = button.querySelector('.airi-ripple');
            if (existingRipple) {
                existingRipple.remove();
            }

            button.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        }

        /**
         * 创建状态指示器
         */
        createStatusIndicator() {
            // 如果已存在，先移除
            const existing = this.avatarBtn?.querySelector('.airi-status');
            if (existing) existing.remove();

            this.statusIndicator = document.createElement('div');
            this.statusIndicator.className = 'airi-status';
            this.avatarBtn.appendChild(this.statusIndicator);
        }

        /**
         * 创建浮动对话气泡（独立于面板）
         */
        createDialogueBubble() {
            // 如果已存在，先移除
            const existing = document.querySelector('.airi-dialogue-bubble');
            if (existing) existing.remove();

            this.dialogueBubble = document.createElement('div');
            this.dialogueBubble.className = 'airi-dialogue-bubble';
            this.dialogueBubble.innerHTML = `
                <div class="airi-bubble-inner">
                    <div class="airi-bubble-content"></div>
                    <div class="airi-bubble-tail"></div>
                </div>
                <div class="airi-emotion-indicator"></div>
            `;

            // 插入到 assistant-container 中
            this.container.insertBefore(this.dialogueBubble, this.container.firstChild);

            // 点击气泡打开面板
            this.dialogueBubble.addEventListener('click', () => {
                if (typeof window.toggleAssistantPanel === 'function') {
                    window.toggleAssistantPanel();
                }
            });
        }

        /**
         * 创建语音可视化器
         */
        createVisualizer() {
            // 如果已存在，先移除
            const existing = this.avatarBtn?.querySelector('.airi-visualizer');
            if (existing) existing.remove();

            this.visualizerContainer = document.createElement('div');
            this.visualizerContainer.className = 'airi-visualizer';

            for (let i = 0; i < CONFIG.speakingBars; i++) {
                const bar = document.createElement('div');
                bar.className = 'airi-visualizer-bar';
                this.visualizerBars.push(bar);
                this.visualizerContainer.appendChild(bar);
            }

            this.avatarBtn.appendChild(this.visualizerContainer);
        }

        /**
         * 开始眨眼动画
         */
        startBlinkAnimation() {
            if (this.blinkTimer) return;

            const blink = () => {
                if (!this.avatarBtn) return;

                this.avatarBtn.classList.add('airi-blinking');

                setTimeout(() => {
                    this.avatarBtn?.classList.remove('airi-blinking');
                }, 150);

                this.blinkTimer = setTimeout(blink, CONFIG.blinkInterval + Math.random() * 2000);
            };

            this.blinkTimer = setTimeout(blink, CONFIG.blinkInterval);
        }

        /**
         * 显示对话（浮动气泡）
         */
        showDialogue(message, options = {}) {
            if (!this.dialogueBubble) return;

            const {
                emotion = 'neutral',
                duration = 4000
            } = options;

            this.setEmotion(emotion);

            const content = this.dialogueBubble.querySelector('.airi-bubble-content');
            const emotionIndicator = this.dialogueBubble.querySelector('.airi-emotion-indicator');

            // 打字机效果
            this.typeWriter(content, message);

            // 设置情绪指示器
            emotionIndicator.className = `airi-emotion-indicator emotion-${emotion}`;

            // 显示气泡
            this.dialogueBubble.classList.add('show');

            // 自动隐藏
            if (this.dialogueTimer) clearTimeout(this.dialogueTimer);
            this.dialogueTimer = setTimeout(() => {
                this.dialogueBubble.classList.remove('show');
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
         * 设置情绪
         */
        setEmotion(emotion) {
            this.currentEmotion = emotion;

            // 更新头像背景渐变
            if (this.avatarBtn) {
                const emotionConfig = CONFIG.emotions[emotion] || CONFIG.emotions.neutral;
                this.avatarBtn.style.background = emotionConfig.gradient;
            }

            // 更新气泡样式
            if (this.dialogueBubble) {
                this.dialogueBubble.setAttribute('data-emotion', emotion);
            }

            // 更新状态指示器
            if (this.statusIndicator) {
                this.statusIndicator.setAttribute('data-emotion', emotion);
            }
        }

        /**
         * 开始说话动画
         */
        startSpeaking() {
            this.isSpeaking = true;
            this.visualizerContainer?.classList.add('active');
            this.animateVisualizer();
        }

        /**
         * 停止说话动画
         */
        stopSpeaking() {
            this.isSpeaking = false;
            this.visualizerContainer?.classList.remove('active');

            // 重置所有条
            this.visualizerBars.forEach(bar => {
                bar.style.height = '4px';
            });
        }

        /**
         * 语音可视化动画
         */
        animateVisualizer() {
            if (!this.isSpeaking) return;

            this.visualizerBars.forEach(bar => {
                const height = 4 + Math.random() * 24;
                bar.style.height = `${height}px`;
            });

            requestAnimationFrame(() => {
                setTimeout(() => this.animateVisualizer(), 50);
            });
        }

        /**
         * 设置状态
         */
        setStatus(status) {
            if (!this.statusIndicator) return;

            this.statusIndicator.className = `airi-status status-${status}`;
        }

        /**
         * 销毁
         */
        destroy() {
            if (this.blinkTimer) {
                clearTimeout(this.blinkTimer);
            }
            if (this.dialogueTimer) {
                clearTimeout(this.dialogueTimer);
            }
            if (this.speakingAnimation) {
                cancelAnimationFrame(this.speakingAnimation);
            }

            // 移除添加的元素
            this.dialogueBubble?.remove();
            this.statusIndicator?.remove();
            this.visualizerContainer?.remove();

            this.isActive = false;
        }
    }

    // ==================== 导出 ====================
    window.AssistantAiri = new AssistantAiriEnhancement();

    // 等待 DOM 加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // 延迟初始化，确保原有元素已创建
            setTimeout(() => {
                window.AssistantAiri.init();
            }, 500);
        });
    } else {
        setTimeout(() => {
            window.AssistantAiri.init();
        }, 500);
    }

    console.log('[AIRI] 已加载');

})();
