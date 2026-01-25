/**
 * Sora2 故事板（Storyboard）+ 固定角色 完整独立示例
 * 
 * 基于云雾API的 OpenAI 官方 multipart/form-data 格式
 * 支持多镜头故事板、固定角色、已有角色复用
 * 
 * 🎯 核心功能：
 * 1. 故事板格式：使用 Shot 1, Shot 2... 格式定义多镜头视频
 * 2. 创建角色：从视频中提取角色（character_url + character_timestamps）
 * 3. 使用已有角色：通过 character_from_task 复用已生成任务的角色
 * 4. 角色锁定：生成视频后自动创建角色（character_create: true）
 * 
 * 📌 API 端点: POST https://yunwu.ai/v1/videos (multipart/form-data)
 */

// ==================== 配置 ====================
const API_BASE_URL = '/api/sora2';  // 本地代理（推荐）
// const API_BASE_URL = 'https://yunwu.ai/v1/videos';  // 直连（需要 API Key）

// ==================== 工具函数 ====================

/**
 * 构建故事板格式的 prompt
 * @param {Array<{duration: number, scene: string}>} shots - 镜头数组
 * @returns {string} 故事板格式的 prompt
 * 
 * @example
 * buildStoryboardPrompt([
 *   { duration: 5, scene: 'A cute purple monster opens the fridge door' },
 *   { duration: 5, scene: 'The monster walks out slowly' },
 *   { duration: 5, scene: 'Another monster appears behind' }
 * ])
 * // 返回：
 * // "Shot 1:\nduration: 5sec\nScene: A cute purple monster opens the fridge door\n\nShot 2:\nduration: 5sec\nScene: The monster walks out slowly\n\nShot 3:\nduration: 5sec\nScene: Another monster appears behind"
 */
function buildStoryboardPrompt(shots) {
    return shots.map((shot, index) => {
        const shotNum = index + 1;
        const duration = shot.duration || 5;
        const scene = shot.scene || shot.description || '';
        return `Shot ${shotNum}:\nduration: ${duration}sec\nScene: ${scene}`;
    }).join('\n\n');
}

/**
 * 获取当前用户ID（从登录状态）
 * @returns {Promise<string>} userId
 */
async function getCurrentUserId() {
    // 尝试从全局状态获取
    if (typeof window !== 'undefined') {
        // 浏览器环境
        if (window.currentUserId) return window.currentUserId;
        if (window.supabaseUser?.id) return window.supabaseUser.id;
        
        // 尝试从 localStorage 获取
        const savedUser = localStorage.getItem('supabase_user');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                return user.id;
            } catch (e) {}
        }
    }
    throw new Error('请先登录');
}

// ==================== 方法一：故事板 + 自动创建角色（最简单）====================
/**
 * 使用故事板格式生成视频，同时从指定视频中自动创建角色
 * 
 * ⚠️ 重要参数说明：
 * - character_url: 包含目标角色的视频URL（注意：视频中不能出现真人，否则会失败）
 * - character_timestamps: 角色出现的时间范围，格式 "start,end"，范围 1-3 秒
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.userId - 用户ID
 * @param {Array} options.shots - 故事板镜头数组
 * @param {string} options.characterVideoUrl - 角色来源视频URL
 * @param {string} options.characterTimestamps - 角色时间范围（如 "1,3"）
 * @param {string} options.seconds - 视频时长（'10' | '15' | '25'），25秒仅pro支持
 * @param {string} options.size - 宽高比（如 "16x9" 横屏，"9x16" 竖屏）
 */
async function generateStoryboardWithAutoCharacter({
    userId,
    shots,
    characterVideoUrl,
    characterTimestamps = '1,3',
    seconds = '15',
    size = '16x9',
    watermark = 'false',
    isPrivate = 'false'
}) {
    console.log('=== 故事板 + 自动创建角色 ===');
    
    // 构建故事板 prompt
    const prompt = buildStoryboardPrompt(shots);
    console.log('📝 故事板 Prompt:\n', prompt);
    
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            model: 'sora-2',
            prompt: prompt,
            seconds: seconds,
            size: size,
            watermark: watermark,
            private: isPrivate,
            
            // 🌟 关键：指定角色来源视频和时间范围
            character_url: characterVideoUrl,
            character_timestamps: characterTimestamps
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || data.error || '视频生成失败');
    }
    
    console.log('✅ 故事板视频任务已提交:', {
        taskId: data.id || data.task_id,
        model: data.model,
        status: data.status,
        seconds: data.seconds
    });
    
    return data;
}

// ==================== 方法二：从已完成任务创建角色 ====================
/**
 * 根据已生成的视频任务ID创建角色
 * 适用于：想从之前生成的视频中提取角色，以便复用
 * 
 * @param {string} userId - 用户ID
 * @param {string} taskId - 已完成的视频任务ID
 * @param {string} timestamps - 角色出现时间范围
 */
async function createCharacterFromTask(userId, taskId, timestamps = '1,3') {
    console.log('=== 从已完成任务创建角色 ===');
    console.log('任务ID:', taskId);
    
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create-character',
            userId: userId,
            from_task: taskId,  // 使用已完成任务ID
            timestamps: timestamps
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || data.error || '角色创建失败');
    }
    
    console.log('✅ 角色创建成功:', {
        id: data.character?.id,
        username: data.character?.username,  // 🌟 重要：保存这个用于复用
        permalink: data.character?.permalink
    });
    
    return data.character;
}

// ==================== 方法三：生成视频时自动创建角色 ====================
/**
 * 生成视频完成后，自动从生成的视频中创建角色
 * 适用于：先生成一个包含特定角色的视频，然后自动将该角色保存供后续使用
 * 
 * @param {Object} options - 配置选项
 */
async function generateAndAutoCreateCharacter({
    userId,
    shots,
    seconds = '15',
    size = '16x9'
}) {
    console.log('=== 生成视频 + 自动创建角色 ===');
    
    const prompt = buildStoryboardPrompt(shots);
    
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            model: 'sora-2',
            prompt: prompt,
            seconds: seconds,
            size: size,
            
            // 🌟 关键：生成完成后自动创建角色
            character_create: true
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || data.error || '视频生成失败');
    }
    
    console.log('✅ 视频任务已提交（完成后将自动创建角色）:', {
        taskId: data.id || data.task_id,
        characterCreate: true
    });
    
    return data;
}

// ==================== 方法四：使用已有角色生成故事板视频 ====================
/**
 * 使用已保存的角色username生成新的故事板视频
 * 这是多次使用角色的核心方法
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.userId - 用户ID
 * @param {Array} options.shots - 故事板镜头数组
 * @param {string|Array} options.characterUsernames - 角色username（单个或数组，最多6个）
 */
async function generateStoryboardWithExistingCharacter({
    userId,
    shots,
    characterUsernames,
    seconds = '15',
    size = '16x9'
}) {
    console.log('=== 使用已有角色生成故事板视频 ===');
    
    // 处理 username：支持单个字符串或数组
    const usernames = Array.isArray(characterUsernames) 
        ? characterUsernames 
        : [characterUsernames];
    
    console.log('使用角色:', usernames);
    
    const prompt = buildStoryboardPrompt(shots);
    
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            model: 'sora-2-all',  // 使用 sora-2-all 确保兼容
            prompt: prompt,
            seconds: seconds,
            size: size,
            
            // 🌟 关键：使用已有角色的 username
            character_usernames: usernames.slice(0, 6)  // 最多6个角色
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || data.error || '视频生成失败');
    }
    
    console.log('✅ 故事板视频任务已提交（使用已有角色）:', {
        taskId: data.id || data.task_id,
        usedCharacters: usernames
    });
    
    return data;
}

// ==================== 角色管理器类 ====================
/**
 * 角色管理器：用于保存、加载、管理角色
 */
class CharacterManager {
    constructor(storageKey = 'sora2_storyboard_characters') {
        this.storageKey = storageKey;
        this.characters = this.load();
    }
    
    // 加载已保存的角色
    load() {
        if (typeof localStorage === 'undefined') return {};
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        } catch (e) {
            return {};
        }
    }
    
    // 保存到本地存储
    save() {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(this.storageKey, JSON.stringify(this.characters));
    }
    
    // 添加角色
    add(name, character, metadata = {}) {
        const username = typeof character === 'string' ? character : character?.username;
        if (!username) {
            throw new Error('无效的角色数据');
        }
        
        this.characters[name] = {
            username: username,
            id: character?.id,
            permalink: character?.permalink,
            profilePicture: character?.profile_picture_url,
            createdAt: new Date().toISOString(),
            ...metadata
        };
        
        this.save();
        console.log(`✅ 角色 "${name}" 已保存，username: ${username}`);
        return this.characters[name];
    }
    
    // 获取角色的 username
    get(name) {
        return this.characters[name]?.username;
    }
    
    // 获取角色完整信息
    getInfo(name) {
        return this.characters[name];
    }
    
    // 列出所有角色
    list() {
        return Object.entries(this.characters).map(([name, data]) => ({
            name,
            ...data
        }));
    }
    
    // 删除角色
    remove(name) {
        if (this.characters[name]) {
            delete this.characters[name];
            this.save();
            console.log(`🗑️ 角色 "${name}" 已删除`);
            return true;
        }
        return false;
    }
    
    // 检查角色是否存在
    has(name) {
        return !!this.characters[name];
    }
    
    // 获取多个角色的 usernames
    getMultiple(names) {
        return names
            .map(name => this.get(name))
            .filter(Boolean);
    }
}

// ==================== 完整工作流程示例 ====================
/**
 * 完整的故事板固定角色工作流程演示
 * 
 * 流程：
 * 1. 创建第一个故事板视频（定义角色外观）
 * 2. 等待完成后，从该视频创建角色
 * 3. 使用该角色生成更多不同场景的视频
 */
async function completeStoryboardWorkflow() {
    console.log('\n🎬 ========== 故事板固定角色完整流程 ==========\n');
    
    const userId = await getCurrentUserId();
    const manager = new CharacterManager();
    
    try {
        // ============ 第1步：创建初始视频（定义角色） ============
        console.log('📹 第1步：创建初始故事板视频（定义角色外观）...\n');
        
        // 定义角色的初始故事板
        const initialShots = [
            { duration: 5, scene: 'A cute purple cartoon monster standing in front of a white background, facing the camera' },
            { duration: 5, scene: 'The purple monster waves hello and smiles' },
            { duration: 5, scene: 'Close-up of the purple monster face, showing friendly expression' }
        ];
        
        const video1 = await generateAndAutoCreateCharacter({
            userId,
            shots: initialShots,
            seconds: '15',
            size: '16x9'
        });
        
        const taskId1 = video1.id || video1.task_id;
        console.log(`✅ 初始视频任务ID: ${taskId1}\n`);
        
        // 等待视频完成
        console.log('⏳ 等待视频生成完成...');
        const completedVideo1 = await pollVideoTask(taskId1, video1._source, video1._endpoint);
        console.log('✅ 初始视频生成完成:', completedVideo1.url || completedVideo1.video_url, '\n');
        
        // ============ 第2步：从视频创建角色 ============
        console.log('🧬 第2步：从生成的视频中创建角色...\n');
        
        const character = await createCharacterFromTask(userId, taskId1, '1,3');
        
        // 保存角色到管理器
        manager.add('purple_monster', character, {
            description: '紫色卡通小怪物',
            sourceTaskId: taskId1
        });
        
        console.log(`✅ 角色 "purple_monster" 已创建并保存\n`);
        console.log(`   Username: ${character.username}`);
        console.log(`   可以在后续视频中重复使用此角色\n`);
        
        // ============ 第3步：使用角色生成新视频 ============
        console.log('🎥 第3步：使用已创建的角色生成新的故事板视频...\n');
        
        // 新场景：角色在不同环境中
        const newShots = [
            { duration: 5, scene: 'The purple monster is in a beautiful garden with flowers' },
            { duration: 5, scene: 'The purple monster picks a red flower and smells it' },
            { duration: 5, scene: 'The purple monster dances happily among the flowers' }
        ];
        
        const video2 = await generateStoryboardWithExistingCharacter({
            userId,
            shots: newShots,
            characterUsernames: manager.get('purple_monster'),
            seconds: '15',
            size: '16x9'
        });
        
        console.log(`✅ 新视频任务ID: ${video2.id || video2.task_id}`);
        console.log('   角色将保持与初始视频一致\n');
        
        // ============ 第4步：再次使用角色（不同场景）============
        console.log('🎥 第4步：继续使用同一角色生成第三个视频...\n');
        
        const thirdShots = [
            { duration: 5, scene: 'The purple monster is on a beach, looking at the ocean' },
            { duration: 5, scene: 'The purple monster builds a sandcastle' },
            { duration: 5, scene: 'The purple monster waves goodbye to the camera' }
        ];
        
        const video3 = await generateStoryboardWithExistingCharacter({
            userId,
            shots: thirdShots,
            characterUsernames: manager.get('purple_monster'),
            seconds: '15',
            size: '16x9'
        });
        
        console.log(`✅ 第三个视频任务ID: ${video3.id || video3.task_id}\n`);
        
        // ============ 完成 ============
        console.log('🎉 ========== 流程完成 ==========\n');
        console.log('📝 总结：');
        console.log(`   - 创建了1个角色: purple_monster (${character.username})`);
        console.log('   - 生成了3个视频任务，角色外观保持一致');
        console.log('   - 角色已保存，可以在任何时候继续使用');
        console.log('\n📦 已保存的角色：');
        console.table(manager.list());
        
        return {
            character,
            tasks: [taskId1, video2.id || video2.task_id, video3.id || video3.task_id]
        };
        
    } catch (error) {
        console.error('❌ 流程出错:', error.message);
        throw error;
    }
}

// ==================== 辅助函数：轮询任务状态 ====================
/**
 * 轮询视频任务直到完成
 */
async function pollVideoTask(taskId, source, endpoint, maxAttempts = 120) {
    console.log(`⏳ 开始轮询任务: ${taskId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'poll',
                    task_id: taskId,
                    _source: source,
                    _endpoint: endpoint
                })
            });
            
            const data = await response.json();
            
            // 检查完成状态
            if (data.status === 'COMPLETED' || data.status === 'completed' || data.status === 'succeeded') {
                console.log('✅ 视频生成完成!');
                return data;
            }
            
            // 检查失败状态
            if (data.status === 'FAILED' || data.status === 'failed') {
                throw new Error(data.error || '视频生成失败');
            }
            
            // 显示进度
            const progress = data.progress || 0;
            console.log(`⏳ 进度: ${progress}% - ${data.status || 'PENDING'} (${i + 1}/${maxAttempts})`);
            
        } catch (error) {
            console.warn(`⚠️ 轮询请求失败 (${i + 1}/${maxAttempts}):`, error.message);
        }
        
        // 等待 5 秒
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('轮询超时：视频生成时间过长');
}

// ==================== 快捷函数：一键使用已有角色 ====================
/**
 * 快捷函数：使用已保存的角色生成新视频
 * 
 * @example
 * // 假设已保存角色 "hero"
 * await quickGenerateWithCharacter('hero', [
 *   { duration: 5, scene: 'The hero enters a dark cave' },
 *   { duration: 5, scene: 'The hero finds a treasure chest' }
 * ]);
 */
async function quickGenerateWithCharacter(characterName, shots, options = {}) {
    const userId = await getCurrentUserId();
    const manager = new CharacterManager();
    
    const username = manager.get(characterName);
    if (!username) {
        throw new Error(`找不到角色 "${characterName}"，请先创建`);
    }
    
    return generateStoryboardWithExistingCharacter({
        userId,
        shots,
        characterUsernames: username,
        seconds: options.seconds || '15',
        size: options.size || '16x9'
    });
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 工具函数
        buildStoryboardPrompt,
        getCurrentUserId,
        pollVideoTask,
        
        // 核心方法
        generateStoryboardWithAutoCharacter,
        createCharacterFromTask,
        generateAndAutoCreateCharacter,
        generateStoryboardWithExistingCharacter,
        
        // 角色管理
        CharacterManager,
        
        // 完整流程
        completeStoryboardWorkflow,
        quickGenerateWithCharacter
    };
}

// 浏览器环境全局暴露
if (typeof window !== 'undefined') {
    window.Sora2Storyboard = {
        // 工具函数
        buildStoryboardPrompt,
        getCurrentUserId,
        pollVideoTask,
        
        // 核心方法
        generateStoryboardWithAutoCharacter,
        createCharacterFromTask,
        generateAndAutoCreateCharacter,
        generateStoryboardWithExistingCharacter,
        
        // 角色管理
        CharacterManager,
        manager: new CharacterManager(),  // 默认实例
        
        // 完整流程
        completeStoryboardWorkflow,
        quickGenerateWithCharacter
    };
    
    console.log('✅ Sora2Storyboard 已加载，使用方式：');
    console.log('   window.Sora2Storyboard.completeStoryboardWorkflow()  // 运行完整流程');
    console.log('   window.Sora2Storyboard.manager.list()  // 查看已保存的角色');
}
