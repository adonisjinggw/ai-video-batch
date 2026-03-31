/**
 * ==================== 小卷助手 VRM/Live2D 模型系统 ====================
 * 基于 @pixiv/three-vrm 的 VRM 模型加载和控制
 * 参考: https://github.com/pixiv/three-vrm
 */

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // CDN 地址（使用 unpkg 加载 Three.js 和 VRM）
        threeUrl: 'https://unpkg.com/three@0.165.0/build/three.module.js',
        vrmUrl: 'https://unpkg.com/@pixiv/three-vrm@2.1.0/lib/three-vrm.module.js',
        // 默认 VRM 模型（使用公开的 VRM 模型）
        defaultModelUrl: 'https://pixiv.github.io/three-vrm/examples/models/three-vrm-girl.vrm',
        // 动画设置
        blinkInterval: 4000,    // 眨眼间隔（毫秒）
        lookAtSmoothness: 0.1,  // 视线跟踪平滑度
        idleAnimationSpeed: 0.5 // 闲置动画速度
    };

    // ==================== VRM 模型管理器 ====================
    class VRMModelManager {
        constructor() {
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.vrm = null;
            this.clock = null;
            this.isLoaded = false;
            this.isAnimating = false;

            // 动画状态
            this.blinkTimer = 0;
            this.isBlinking = false;
            this.targetLookAt = null;
            this.currentLookAt = null;

            // 回调函数
            this.onLoadCallback = null;
            this.onErrorCallback = null;

            // THREE 引用（动态加载后设置）
            this.THREE = null;
            this.VRMUtils = null;
        }

        /**
         * 初始化 Three.js 场景
         */
        async init(canvas) {
            try {
                // 动态加载 Three.js 和 VRM
                const threeModule = await this.loadModule(CONFIG.threeUrl);
                const vrmModule = await this.loadModule(CONFIG.vrmUrl);

                this.THREE = threeModule;
                // VRM 2.x 的导出方式不同
                this.VRMUtils = vrmModule.VRMUtils || vrmModule;

                // 创建 Clock
                this.clock = new this.THREE.Clock();
                this.targetLookAt = new this.THREE.Vector3();
                this.currentLookAt = new this.THREE.Vector3();

                // 创建场景
                this.scene = new this.THREE.Scene();
                this.scene.background = new this.THREE.Color(0x000000); // 透明背景

                // 创建相机
                this.camera = new this.THREE.PerspectiveCamera(
                    30,
                    canvas.clientWidth / canvas.clientHeight,
                    0.1,
                    20.0
                );
                this.camera.position.set(0, 1.4, 3);

                // 创建渲染器
                this.renderer = new this.THREE.WebGLRenderer({
                    canvas: canvas,
                    alpha: true,
                    antialias: true,
                    premultipliedAlpha: true
                });
                this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                // 添加光源
                const light = new this.THREE.DirectionalLight(0xffffff, 1.5);
                light.position.set(1, 1, 1).normalize();
                this.scene.add(light);

                const ambient = new this.THREE.AmbientLight(0xffffff, 0.4);
                this.scene.add(ambient);

                // 添加半球光（更自然的肤色）
                const hemi = new this.THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
                this.scene.add(hemi);

                console.log('[VRM模型] 场景初始化完成');
                return true;
            } catch (e) {
                console.error('[VRM模型] 初始化失败:', e);
                if (this.onErrorCallback) this.onErrorCallback(e);
                return false;
            }
        }

        /**
         * 动态加载 ES 模块
         */
        async loadModule(url) {
            const module = await import(url);
            return module;
        }

        /**
         * 加载 VRM 模型
         */
        async loadModel(modelUrl = CONFIG.defaultModelUrl) {
            try {
                if (!this.THREE) {
                    throw new Error('VRM 系统未初始化，请先调用 init()');
                }

                // 移除旧模型
                if (this.vrm) {
                    this.scene.remove(this.vrm.scene);
                    this.vrm.dispose();
                }

                console.log('[VRM模型] 正在加载模型:', modelUrl);

                // 加载模型 - 使用 GLTFLoader
                const GLTFLoader = this.THREE.GLTFLoader || this.THREE.GLTFLoaderCompat;
                if (!GLTFLoader) {
                    throw new Error('GLTFLoader 不可用');
                }

                const loader = new GLTFLoader();
                const gltf = await this.loadGLTF(loader, modelUrl);

                // 提取 VRM（VRM 2.x 格式）
                const vrm = gltf.userData?.vrm || gltf.vrm;

                if (!vrm) {
                    throw new Error('加载的文件不是有效的 VRM 模型');
                }

                this.vrm = vrm;

                // 调整模型
                if (this.VRMUtils && this.VRMUtils.deepRemoveVertexColors) {
                    this.VRMUtils.deepRemoveVertexColors(vrm.scene);
                }
                if (this.VRMUtils && this.VRMUtils.removeUnnecessaryVertices) {
                    this.VRMUtils.removeUnnecessaryVertices(vrm.scene);
                }
                vrm.scene.rotation.y = Math.PI; // 面向前方

                this.scene.add(vrm.scene);

                // 设置 VRM 功能
                this.setupVRMFeatures();

                this.isLoaded = true;

                // 启动动画循环
                this.startAnimation();

                console.log('[VRM模型] 模型加载完成');

                if (this.onLoadCallback) {
                    this.onLoadCallback(vrm);
                }

                return vrm;
            } catch (e) {
                console.error('[VRM模型] 加载失败:', e);
                if (this.onErrorCallback) {
                    this.onErrorCallback(e);
                }
                throw e;
            }
        }

        /**
         * 加载 GLTF 文件（Promise 包装）
         */
        loadGLTF(loader, url) {
            return new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });
        }

        /**
         * 设置 VRM 功能（眨眼、视线跟踪等）
         */
        setupVRMFeatures() {
            if (!this.vrm) return;

            // 启用自动眨眼
            if (this.vrm.expressionManager) {
                this.vrm.expressionManager.registerExpression('blink', {
                    isBinary: false,
                    overrideBlink: 'left',
                    overrideBlink: 'right',
                });
            }

            // 启用视线跟踪
            if (this.vrm.lookAt) {
                this.vrm.lookAt.enabled = true;
            }

            // 设置默认姿势
            if (this.vrm.humanoid) {
                // 设置自然的站立姿势
                this.vrm.humanoid.getNormalizedBoneNode('hips').rotation.x = 0;
            }
        }

        /**
         * 启动动画循环
         */
        startAnimation() {
            if (this.isAnimating) return;

            this.isAnimating = true;

            const animate = () => {
                requestAnimationFrame(animate);

                if (!this.vrm) return;

                const delta = this.clock.getDelta();

                // 更新 VRM
                this.vrm.update(delta);

                // 处理眨眼
                this.updateBlink(delta);

                // 处理视线跟踪
                this.updateLookAt(delta);

                // 处理闲置动画
                this.updateIdleAnimation(delta);

                // 渲染
                this.renderer.render(this.scene, this.camera);
            };

            animate();
        }

        /**
         * 更新眨眼动画
         */
        updateBlink(delta) {
            if (!this.vrm || !this.vrm.expressionManager) return;

            this.blinkTimer += delta * 1000;

            if (this.blinkTimer > CONFIG.blinkInterval) {
                this.blinkTimer = 0;
                this.isBlinking = true;
                setTimeout(() => {
                    this.isBlinking = false;
                }, 150);
            }

            // 设置眨眼值
            const blinkValue = this.isBlinking ? 1 : 0;
            this.vrm.expressionManager.setValue('blink', blinkValue);
        }

        /**
         * 更新视线跟踪
         */
        updateLookAt(delta) {
            if (!this.vrm || !this.vrm.lookAt) return;

            // 平滑插值到目标位置
            this.currentLookAt.lerp(this.targetLookAt, CONFIG.lookAtSmoothness);

            // 设置视线目标
            this.vrm.lookAt.target.set(
                this.currentLookAt.x,
                this.currentLookAt.y,
                this.currentLookAt.z
            );
        }

        /**
         * 更新闲置动画
         */
        updateIdleAnimation(delta) {
            if (!this.vrm || !this.vrm.humanoid) return;

            const time = this.clock.elapsedTime;

            // 轻微的呼吸动画
            const breath = Math.sin(time * 2) * 0.02;
            const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
            if (hips) {
                hips.position.y = breath;
            }

            // 轻微的头部摆动
            const head = this.vrm.humanoid.getNormalizedBoneNode('head');
            if (head) {
                head.rotation.y = Math.sin(time * 0.5) * 0.05;
                head.rotation.x = Math.sin(time * 0.7) * 0.02;
            }
        }

        /**
         * 设置视线目标
         */
        setLookAt(x, y, z) {
            this.targetLookAt.set(x, y, z);
        }

        /**
         * 跟随鼠标位置
         */
        followMouse(mouseX, mouseY) {
            // 将鼠标坐标转换为 3D 空间坐标
            const x = (mouseX / window.innerWidth) * 2 - 1;
            const y = -(mouseY / window.innerHeight) * 2 + 1;

            this.setLookAt(x * 2, y * 2 + 1.4, -3);
        }

        /**
         * 设置表情
         */
        setExpression(name, value = 1) {
            if (!this.vrm || !this.vrm.expressionManager) return;

            // VRM 1.0 使用 setValue
            if (this.vrm.expressionManager.setValue) {
                this.vrm.expressionManager.setValue(name, value);
            }
        }

        /**
         * 播放预设表情
         */
        playEmotion(emotion) {
            const emotionMap = {
                'happy': 'happy',
                'angry': 'angry',
                'sad': 'sad',
                'surprised': 'surprised',
                'neutral': 'neutral'
            };

            const expression = emotionMap[emotion] || emotion;
            this.setExpression(expression, 1);

            // 2秒后恢复中性表情
            setTimeout(() => {
                this.setExpression(expression, 0);
            }, 2000);
        }

        /**
         * 说话动画（嘴唇动画）
         */
        startSpeaking() {
            if (!this.vrm || !this.vrm.expressionManager) return;

            this.isSpeaking = true;

            const speakInterval = setInterval(() => {
                if (!this.isSpeaking) {
                    clearInterval(speakInterval);
                    // 恢复嘴巴闭合
                    if (this.vrm.expressionManager.setValue) {
                        this.vrm.expressionManager.setValue('aa', 0);
                        this.vrm.expressionManager.setValue('ih', 0);
                        this.vrm.expressionManager.setValue('ou', 0);
                    }
                    return;
                }

                // 随机嘴型
                const vowels = ['aa', 'ih', 'ou'];
                const vowel = vowels[Math.floor(Math.random() * vowels.length)];
                const value = 0.3 + Math.random() * 0.4;

                if (this.vrm.expressionManager.setValue) {
                    this.vrm.expressionManager.setValue(vowel, value);
                }
            }, 100);
        }

        /**
         * 停止说话动画
         */
        stopSpeaking() {
            this.isSpeaking = false;
        }

        /**
         * 调整大小
         */
        resize(width, height) {
            if (!this.camera || !this.renderer) return;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        /**
         * 设置加载完成回调
         */
        onLoad(callback) {
            this.onLoadCallback = callback;
        }

        /**
         * 设置错误回调
         */
        onError(callback) {
            this.onErrorCallback = callback;
        }

        /**
         * 销毁 VRM 模型
         */
        dispose() {
            this.isAnimating = false;

            if (this.vrm) {
                this.scene.remove(this.vrm.scene);
                this.vrm.dispose();
                this.vrm = null;
            }

            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }

            this.isLoaded = false;
        }
    }

    // ==================== 导出 ====================
    window.AssistantVRM = new VRMModelManager();

    console.log('[VRM模型系统] 已加载');

})();
