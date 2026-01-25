/**
 * Sora2 固定角色（Character）功能完整示例
 * 基于云雾API的OpenAI官方格式实现角色一致性视频生成
 * 
 * 🎯 核心功能：
 * 1. 从已有视频中提取角色信息（创建角色）
 * 2. 使用已创建的角色生成新视频（保持角色一致）
 * 3. 支持多角色同时使用
 * 4. 支持角色在多个视频中复用
 */

// ==================== 方法一：使用 character_url + character_timestamps（推荐，最简单）====================
/**
 * 这是 OpenAI 官方格式，云雾API会自动创建角色并应用
 * 无需手动调用 create-character，一步到位
 */
async function generateVideoWithAutoCharacter(userId) {
    console.log('=== 方法一：自动创建并使用角色 ===');
    
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,  // 必需：用户ID
            prompt: 'A person walking in a garden',  // 视频描述
            model: 'sora-2-all',  // 使用 sora-2-all 模型
            
            // 🌟 关键参数：指定包含角色的视频URL和时间范围
            character_url: 'https://example.com/reference-video.mp4',  // 包含目标角色的视频URL
            character_timestamps: '1,3',  // 提取角色的时间范围（1-3秒），范围差值最大3秒最小1秒
            
            // 可选参数
            aspect_ratio: '16:9',  // 视频比例
            duration: 15,  // 视频时长（秒）
            hd: false  // 是否高清
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || '视频生成失败');
    }
    
    console.log('✅ 视频任务已提交:', data.task_id);
    return data;
}

// ==================== 方法二：手动创建角色，然后复用（适合多次使用同一角色）====================
/**
 * 步骤：
 * 1. 先调用 create-character 创建角色，获得 username
 * 2. 在后续视频生成中使用 character_usernames 参数
 * 3. 该 username 可以在多个视频中重复使用
 */

// 步骤1：创建角色
async function createCharacterFromVideo(userId, videoUrl, timestamps = '1,3') {
    console.log('=== 步骤1：创建角色 ===');
    
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create-character',
            userId: userId,  // 必需：用户ID
            url: videoUrl,  // 包含目标角色的视频URL
            timestamps: timestamps  // 提取角色的时间范围（例如 '1,3' 表示1-3秒）
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || '角色创建失败');
    }
    
    console.log('✅ 角色创建成功:', {
        id: data.character.id,
        username: data.character.username,  // 🌟 重要：这个username可以重复使用
        permalink: data.character.permalink,
        profile_picture: data.character.profile_picture_url
    });
    
    return data.character;
}

// 步骤2：使用已创建的角色生成视频
async function generateVideoWithExistingCharacter(userId, characterUsername) {
    console.log('=== 步骤2：使用已有角色生成视频 ===');
    
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            prompt: 'Dancing in a modern city',
            model: 'sora-2-all',
            
            // 🌟 关键参数：使用已有角色的username
            character_usernames: [characterUsername],  // 可以是数组（支持多个角色）
            // 或者使用单个字符串：
            // character_username: characterUsername,
            
            aspect_ratio: '16:9',
            duration: 15,
            hd: false
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || '视频生成失败');
    }
    
    console.log('✅ 使用角色生成视频任务已提交:', data.task_id);
    return data;
}

// ==================== 方法三：多角色同时使用 ====================
/**
 * 在一个视频中同时使用多个角色（最多6个）
 */
async function generateVideoWithMultipleCharacters(userId, characterUsernames) {
    console.log('=== 方法三：多角色视频生成 ===');
    
    // characterUsernames 是一个数组，例如：['user_abc123', 'user_def456', 'user_ghi789']
    
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'text-to-video',
            userId: userId,
            prompt: 'Three friends having a picnic in the park',
            model: 'sora-2-all',
            
            // 🌟 使用多个角色（最多6个）
            character_usernames: characterUsernames.slice(0, 6),  // 确保不超过6个
            
            aspect_ratio: '16:9',
            duration: 15
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || '视频生成失败');
    }
    
    console.log('✅ 多角色视频任务已提交:', data.task_id);
    return data;
}

// ==================== 完整流程示例 ====================
/**
 * 完整演示：从创建角色到多次使用
 */
async function completeCharacterWorkflow(userId) {
    console.log('\n🎬 开始完整的角色固定流程演示\n');
    
    try {
        // 1️⃣ 从已有视频创建角色
        console.log('📹 第1步：从视频中提取角色...');
        const sourceVideoUrl = 'https://example.com/person-video.mp4';
        const character = await createCharacterFromVideo(userId, sourceVideoUrl, '1,3');
        const username = character.username;
        
        console.log(`✅ 角色已创建，username: ${username}\n`);
        
        // 💾 保存 username 到本地存储或数据库，以便后续使用
        localStorage.setItem('myCharacterUsername', username);
        
        // 2️⃣ 使用该角色生成第一个视频
        console.log('🎥 第2步：使用角色生成第一个视频...');
        const video1 = await generateVideoWithExistingCharacter(userId, username);
        console.log('✅ 第一个视频任务ID:', video1.task_id, '\n');
        
        // 等待第一个视频完成（轮询）
        const video1Url = await pollVideoTask(video1.task_id, video1._source, video1._endpoint);
        console.log('✅ 第一个视频生成完成:', video1Url, '\n');
        
        // 3️⃣ 再次使用同一个角色生成第二个视频（不同场景）
        console.log('🎥 第3步：用同一角色生成第二个视频（不同场景）...');
        const video2Response = await fetch('/api/sora2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text-to-video',
                userId: userId,
                prompt: 'The same person riding a bicycle on the beach',  // 不同场景
                model: 'sora-2-all',
                character_usernames: [username],  // 使用同一个username
                aspect_ratio: '16:9',
                duration: 15
            })
        });
        
        const video2 = await video2Response.json();
        console.log('✅ 第二个视频任务ID:', video2.task_id, '\n');
        
        // 4️⃣ 创建第二个角色并使用两个角色
        console.log('👥 第4步：创建第二个角色，制作双人视频...');
        const secondVideoUrl = 'https://example.com/another-person-video.mp4';
        const character2 = await createCharacterFromVideo(userId, secondVideoUrl, '2,4');
        
        console.log(`✅ 第二个角色已创建，username: ${character2.username}\n`);
        
        // 使用两个角色生成双人视频
        const dualVideo = await generateVideoWithMultipleCharacters(userId, [username, character2.username]);
        console.log('✅ 双人视频任务ID:', dualVideo.task_id, '\n');
        
        console.log('🎉 完整流程演示完成！');
        console.log('\n📝 总结：');
        console.log(`   - 创建了2个角色: ${username}, ${character2.username}`);
        console.log(`   - 生成了3个视频任务`);
        console.log(`   - 角色可以在多个视频中重复使用`);
        
    } catch (error) {
        console.error('❌ 流程出错:', error.message);
        throw error;
    }
}

// ==================== 辅助函数：轮询视频任务状态 ====================
async function pollVideoTask(taskId, source, endpoint, maxAttempts = 60) {
    console.log(`⏳ 开始轮询任务: ${taskId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch('/api/sora2', {
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
        
        if (data.status === 'COMPLETED' || data.status === 'completed') {
            console.log('✅ 视频生成完成!');
            return data.url || data.video_url || data.output_url;
        }
        
        if (data.status === 'FAILED' || data.status === 'failed') {
            throw new Error(data.error || '视频生成失败');
        }
        
        console.log(`⏳ 进度: ${data.status || 'PENDING'} (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));  // 等待5秒
    }
    
    throw new Error('轮询超时');
}

// ==================== 图生视频也支持角色固定 ====================
/**
 * 图生视频同样支持使用已有角色
 * 注意：图生视频无法创建新角色，只能使用已有的 username
 */
async function imageToVideoWithCharacter(userId, imageUrl, characterUsername) {
    console.log('=== 图生视频 + 角色固定 ===');
    
    const response = await fetch('/api/sora2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'image-to-video',
            userId: userId,
            image_url: imageUrl,  // 参考图片URL
            prompt: 'Walking forward with a smile',
            model: 'sora-2-all',
            
            // 🌟 使用已有角色
            character_usernames: [characterUsername],
            
            aspect_ratio: '16:9',
            duration: 15
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || '图生视频失败');
    }
    
    console.log('✅ 图生视频任务已提交:', data.task_id);
    return data;
}

// ==================== 导出函数供外部调用 ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // 方法一：自动创建
        generateVideoWithAutoCharacter,
        
        // 方法二：手动创建+复用
        createCharacterFromVideo,
        generateVideoWithExistingCharacter,
        
        // 方法三：多角色
        generateVideoWithMultipleCharacters,
        
        // 完整流程
        completeCharacterWorkflow,
        
        // 图生视频
        imageToVideoWithCharacter,
        
        // 工具函数
        pollVideoTask
    };
}

// ==================== 浏览器环境全局暴露 ====================
if (typeof window !== 'undefined') {
    window.Sora2CharacterExample = {
        generateVideoWithAutoCharacter,
        createCharacterFromVideo,
        generateVideoWithExistingCharacter,
        generateVideoWithMultipleCharacters,
        completeCharacterWorkflow,
        imageToVideoWithCharacter,
        pollVideoTask
    };
}
