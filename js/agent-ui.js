/**
 * 🤖 Agent Team UI - 团队面板交互组件
 * @version 1.0.0
 * 
 * 提供: 团队选择、任务输入、Agent状态面板、消息流、结果展示
 * 嵌入 chat.html 使用
 */

(function (global) {
    'use strict';

    const AgentUI = {
        _currentTeam: null,
        _selectedTemplate: null,
        _customRoles: [],
        _isRunning: false,
        _refImages: [], // [{base64, name, size}]

        // ==================== 面板控制 ====================

        /** 打开团队面板 */
        open() {
            const panel = document.getElementById('agentTeamPanel');
            if (!panel) return;
            panel.style.display = 'flex';
            this._renderTemplateList();
            this._showView('select'); // 默认显示团队选择
        },

        /** 关闭面板 */
        close() {
            if (this._isRunning) {
                if (!confirm('团队正在执行中，确定要关闭吗？')) return;
                if (this._currentTeam) this._currentTeam.cancel();
            }
            const panel = document.getElementById('agentTeamPanel');
            if (panel) panel.style.display = 'none';
            this._isRunning = false;
        },

        /** 切换视图 */
        _showView(view) {
            ['select', 'config', 'running', 'result'].forEach(v => {
                const el = document.getElementById(`atView_${v}`);
                if (el) el.style.display = (v === view) ? 'flex' : 'none';
            });
        },

        // ==================== 团队选择 ====================

        _renderTemplateList() {
            const container = document.getElementById('atTemplateGrid');
            if (!container) return;

            const templates = AgentTeamFactory.getTemplates();
            container.innerHTML = templates.map(t => `
                <div class="at-template-card ${t.isCustom ? 'at-custom' : ''}" onclick="AgentUI.selectTemplate('${t.id}')">
                    <div class="at-tpl-icon">${t.icon}</div>
                    <div class="at-tpl-name">${t.name}</div>
                    <div class="at-tpl-desc">${t.description}</div>
                    <div class="at-tpl-roles">${t.roles.length} 位成员</div>
                </div>
            `).join('');
        },

        /** 选择团队模板 */
        selectTemplate(templateId) {
            this._selectedTemplate = templateId;
            const templates = AgentTeamFactory.getTemplates();
            const template = templates.find(t => t.id === templateId);
            if (!template) return;

            if (template.isCustom) {
                this._showCustomConfig();
                return;
            }

            // 显示配置视图
            this._showView('config');
            this._renderTeamConfig(template);
        },

        /** 显示自由组队配置 */
        _showCustomConfig() {
            this._showView('config');
            const configArea = document.getElementById('atConfigArea');
            if (!configArea) return;

            const allRoles = AgentTeamFactory.getAllRoles();
            const builtIn = allRoles.filter(r => !r.isCustom);
            const custom = allRoles.filter(r => r.isCustom);

            configArea.innerHTML = `
                <div class="at-config-title">🎯 自由组队</div>
                <div class="at-config-subtitle">选择你需要的团队成员（项目总监自动加入）</div>
                <div class="at-role-grid">
                    ${builtIn.map(role => `
                        <label class="at-role-check">
                            <input type="checkbox" value="${role.id}" onchange="AgentUI._onCustomRoleChange()">
                            <span class="at-role-icon">${role.icon}</span>
                            <span class="at-role-name">${role.name}</span>
                        </label>
                    `).join('')}
                </div>
                ${custom.length > 0 ? `
                    <div style="margin-top:12px;font-size:13px;color:var(--accent);font-weight:600">🧩 我的自定义角色</div>
                    <div class="at-role-grid">
                        ${custom.map(role => `
                            <label class="at-role-check at-role-custom">
                                <input type="checkbox" value="${role.id}" onchange="AgentUI._onCustomRoleChange()">
                                <span class="at-role-icon">${role.icon}</span>
                                <span class="at-role-name">${role.name}</span>
                                <span class="at-role-delete" onclick="event.preventDefault();event.stopPropagation();AgentUI._deleteCustomRole('${role.id}')" title="删除">✕</span>
                            </label>
                        `).join('')}
                    </div>
                ` : ''}
                <button class="at-btn at-btn-outline" style="margin-top:10px;width:100%" onclick="AgentUI._showCreateRoleForm()">＋ 创建自定义角色</button>
                <div id="atCustomRoleForm" style="display:none"></div>
                ${this._renderRefImageSection()}
                <div class="at-goal-section">
                    <div class="at-goal-label">项目目标</div>
                    <textarea id="atGoalInput" class="at-goal-input" rows="3" placeholder="描述你的项目目标..."></textarea>
                </div>
                <div class="at-config-actions">
                    <button class="at-btn at-btn-secondary" onclick="AgentUI._showView('select')">返回</button>
                    <button class="at-btn at-btn-primary" id="atStartBtn" onclick="AgentUI.startTeam()">🚀 开始执行</button>
                </div>
            `;
        },

        _onCustomRoleChange() {
            const checks = document.querySelectorAll('.at-role-check input:checked');
            this._customRoles = Array.from(checks).map(c => c.value);
        },

        /** 显示创建自定义角色表单 */
        _showCreateRoleForm() {
            const form = document.getElementById('atCustomRoleForm');
            if (!form) return;

            const toolNames = {
                text_gen: '📝 文本生成', text_write: '✍️ 长文写作',
                image_banana: '🎨 图片(Banana)', image_modelscope: '🖼️ 图片(ModelScope)',
                video_text: '🎬 文生视频', video_image: '📹 图生视频',
                ocr: '👁️ 图片识别', save_image: '💾 保存图片',
                save_video: '💾 保存视频', save_character: '👤 保存角色'
            };
            const emojiList = ['🧩','🤖','👨‍💻','👩‍🎨','🦊','🐱','🐶','🦁','🐼','🐸','🌟','⚡','🔥','💎','🎯','🎪','🎭','🎨','🎵','🎬','📱','💡','🧠','👑','🦄','🌈','🍀','🌸','❄️','🌊'];

            form.style.display = 'block';
            form.innerHTML = `
                <div class="at-create-role-form">
                    <div style="font-weight:600;margin-bottom:8px">🧩 创建自定义角色</div>
                    <div class="at-form-row">
                        <label>图标</label>
                        <div class="at-emoji-grid" id="atEmojiPicker">
                            ${emojiList.map((e, i) => `<span class="at-emoji-opt ${i === 0 ? 'selected' : ''}" onclick="AgentUI._pickEmoji(this)">${e}</span>`).join('')}
                        </div>
                    </div>
                    <div class="at-form-row">
                        <label>角色名称</label>
                        <input type="text" id="atRoleName" placeholder="如: 小红书达人" maxlength="20" class="at-form-input">
                    </div>
                    <div class="at-form-row">
                        <label>角色描述 / 系统提示词</label>
                        <textarea id="atRolePrompt" rows="4" placeholder="描述这个角色的专长和工作方式..." class="at-form-input"></textarea>
                    </div>
                    <div class="at-form-row">
                        <label>可用工具（至少选一个）</label>
                        <div class="at-tool-grid">
                            ${Object.entries(toolNames).map(([k, v]) => `
                                <label class="at-tool-check">
                                    <input type="checkbox" value="${k}" ${k === 'text_gen' ? 'checked' : ''}>
                                    <span>${v}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="at-form-actions">
                        <button class="at-btn at-btn-secondary" onclick="document.getElementById('atCustomRoleForm').style.display='none'">取消</button>
                        <button class="at-btn at-btn-primary" onclick="AgentUI._saveCustomRole()">✅ 保存角色</button>
                    </div>
                </div>
            `;
        },

        _pickEmoji(el) {
            document.querySelectorAll('.at-emoji-opt.selected').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
        },

        /** 保存自定义角色 */
        _saveCustomRole() {
            const name = document.getElementById('atRoleName')?.value?.trim();
            const prompt = document.getElementById('atRolePrompt')?.value?.trim();
            const icon = document.querySelector('.at-emoji-opt.selected')?.textContent || '🧩';
            const tools = Array.from(document.querySelectorAll('.at-tool-grid input:checked')).map(c => c.value);

            if (!name) { if (typeof showToast === 'function') showToast('请输入角色名称'); return; }
            if (!prompt) { if (typeof showToast === 'function') showToast('请输入角色描述'); return; }
            if (tools.length === 0) { if (typeof showToast === 'function') showToast('请至少选择一个工具'); return; }

            try {
                AgentTeamFactory.createCustomRole({ name, icon, systemPrompt: prompt, tools });
                AgentTeamFactory.saveCustomRoles();
                if (typeof showToast === 'function') showToast(`✅ 角色「${name}」已创建`);
                this._showCustomConfig(); // 刷新列表
            } catch (e) {
                if (typeof showToast === 'function') showToast('创建失败: ' + e.message);
            }
        },

        /** 删除自定义角色 */
        _deleteCustomRole(roleId) {
            if (!confirm('确定删除这个自定义角色？')) return;
            AgentTeamFactory.deleteCustomRole(roleId);
            if (typeof showToast === 'function') showToast('已删除');
            this._showCustomConfig();
        },

        /** 渲染团队配置 */
        _renderTeamConfig(template) {
            const configArea = document.getElementById('atConfigArea');
            if (!configArea) return;

            const roles = template.roles.map(id => AgentTeamFactory._roleConfigs.get(id)).filter(Boolean);
            const suggestions = template.suggestedGoals || [];
            const cost = template.estimatedCost || 8;

            configArea.innerHTML = `
                <div class="at-config-title">${template.icon} ${template.name}</div>
                <div class="at-config-subtitle">${template.description}</div>
                <div style="color:var(--accent);font-size:13px;margin:4px 0;">🎬 预估消耗: 约${cost} 胶片</div>
                <div class="at-team-members">
                    ${roles.map(r => `
                        <div class="at-member">
                            <span class="at-member-icon">${r.icon}</span>
                            <span class="at-member-name">${r.name}</span>
                            <span class="at-member-tools">${r.tools.length} 工具</span>
                        </div>
                    `).join('')}
                </div>
                ${this._renderRefImageSection()}
                <div class="at-goal-section">
                    <div class="at-goal-label">项目目标</div>
                    <textarea id="atGoalInput" class="at-goal-input" rows="3" placeholder="描述你的项目目标..."></textarea>
                    ${suggestions.length > 0 ? `
                        <div class="at-suggestions">
                            ${suggestions.map(s => `
                                <button class="at-suggest-btn" onclick="document.getElementById('atGoalInput').value='${s.replace(/'/g, "\\'")}'">💡 ${s}</button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="at-config-actions">
                    <button class="at-btn at-btn-secondary" onclick="AgentUI._showView('select')">返回</button>
                    <button class="at-btn at-btn-primary" id="atStartBtn" onclick="AgentUI.startTeam()">🚀 开始执行</button>
                </div>
            `;
        },

        // ==================== 🖼️ 参考图上传 ====================

        /** 渲染参考图上传区域 HTML */
        _renderRefImageSection() {
            const previews = this._refImages.map((img, i) => `
                <div class="at-ref-thumb" style="position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;flex-shrink:0;">
                    <img src="${img.base64}" style="width:100%;height:100%;object-fit:cover;">
                    <span onclick="AgentUI._removeRefImage(${i})" style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,0.7);color:#fff;border-radius:50%;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</span>
                </div>
            `).join('');

            return `
                <div class="at-ref-section" style="margin:12px 0;">
                    <div style="font-size:13px;color:#aaa;margin-bottom:6px;">🖼️ 参考图（可选，团队将参考这些图片的风格/内容）</div>
                    <div id="atRefPreviews" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">${previews}</div>
                    <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(255,255,255,0.06);border:1px dashed #444;border-radius:10px;cursor:pointer;color:#888;font-size:13px;">
                        <span>📷 上传参考图</span>
                        <input type="file" accept="image/*" multiple style="display:none;" onchange="AgentUI._handleRefImageUpload(this)">
                    </label>
                    ${this._refImages.length > 0 ? `<span style="margin-left:8px;font-size:12px;color:#666;">已上传 ${this._refImages.length} 张</span>` : ''}
                </div>
            `;
        },

        /** 处理参考图上传 */
        _handleRefImageUpload(input) {
            const files = Array.from(input.files || []);
            if (files.length === 0) return;

            let loaded = 0;
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                if (file.size > 10 * 1024 * 1024) {
                    if (typeof showToast === 'function') showToast(`${file.name} 超过10MB，已跳过`);
                    continue;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    this._refImages.push({ base64: reader.result, name: file.name, size: file.size });
                    loaded++;
                    if (loaded >= files.length) {
                        this._refreshRefPreviews();
                    }
                };
                reader.onerror = () => { loaded++; };
                reader.readAsDataURL(file);
            }
        },

        /** 删除参考图 */
        _removeRefImage(index) {
            this._refImages.splice(index, 1);
            this._refreshRefPreviews();
        },

        /** 刷新参考图预览区 */
        _refreshRefPreviews() {
            const container = document.getElementById('atRefPreviews');
            if (!container) return;
            container.innerHTML = this._refImages.map((img, i) => `
                <div class="at-ref-thumb" style="position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;flex-shrink:0;">
                    <img src="${img.base64}" style="width:100%;height:100%;object-fit:cover;">
                    <span onclick="AgentUI._removeRefImage(${i})" style="position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,0.7);color:#fff;border-radius:50%;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</span>
                </div>
            `).join('');
            // 更新计数
            const section = container.closest('.at-ref-section');
            if (section) {
                const countSpan = section.querySelector('span[style*="color:#666"]');
                if (countSpan) countSpan.textContent = this._refImages.length > 0 ? `已上传 ${this._refImages.length} 张` : '';
            }
        },

        // ==================== 团队执行 ====================

        async startTeam() {
            const goalInput = document.getElementById('atGoalInput');
            const goal = goalInput?.value?.trim();
            if (!goal) {
                if (typeof showToast === 'function') showToast('请输入项目目标');
                return;
            }

            // 💰 检查登录（后端按次扣费，不再前端预扣）
            if (typeof currentUser !== 'undefined' && !currentUser) {
                if (typeof showToast === 'function') showToast('请先登录后再使用团队功能');
                return;
            }
            // 余额软提示（仅参考，实际按后端调用扣费）
            const templates = typeof AgentTeamFactory !== 'undefined' ? AgentTeamFactory.getTemplates() : [];
            const tpl = templates.find(t => t.id === this._selectedTemplate);
            const estCost = tpl?.estimatedCost || 8;
            if (typeof userQuota !== 'undefined' && userQuota < estCost) {
                if (!confirm(`余额(${userQuota}胶片)可能不足（预估约${estCost}胶片），是否继续？`)) return;
            }

            // 创建团队
            try {
                if (this._selectedTemplate === 'custom') {
                    this._currentTeam = AgentTeamFactory.createCustomTeam('自由团队', ['coordinator', ...this._customRoles]);
                } else {
                    this._currentTeam = AgentTeamFactory.createFromTemplate(this._selectedTemplate);
                }
            } catch (err) {
                if (typeof showToast === 'function') showToast('创建团队失败: ' + err.message);
                return;
            }

            // 切换到运行视图（先切换，避免参考图分析阻塞UI）
            this._showView('running');
            this._isRunning = true;
            this._renderRunningView();
            this._bindTeamEvents();

            // 🖼️ 传递参考图给团队（已切换到运行视图，用户可看到进度）
            if (this._refImages.length > 0) {
                this._addMessage('system', 'info', `📷 正在分析 ${this._refImages.length} 张参考图...`, '🖼️', '系统');
                for (const img of this._refImages) {
                    try {
                        await this._currentTeam.addReferenceImage(img.base64, img.name);
                    } catch (e) {
                        console.warn('参考图分析失败，跳过:', e.message);
                    }
                }
                this._addMessage('system', 'info', `📷 参考图处理完成，开始执行任务`, '✅', '系统');
            }

            // 💰 团队一次性预扣费（后端API调用不再重复扣费）
            const teamBillingId = 'team_' + Date.now();
            let teamBillingDone = false;
            if (typeof currentUser !== 'undefined' && currentUser && typeof Billing !== 'undefined') {
                try {
                    await Billing.reserveFilm(currentUser.id, estCost, teamBillingId);
                    teamBillingDone = true;
                    if (typeof refreshBalance === 'function') refreshBalance();
                } catch (e) {
                    if (e.message && e.message.includes('INSUFFICIENT')) {
                        if (typeof showToast === 'function') showToast('余额不足，请先充值');
                        this._isRunning = false;
                        return;
                    }
                    console.warn('[AgentUI] 预扣费失败，继续执行:', e.message);
                }
            }

            // 🔒 开启扣费会话（内部API调用跳过逐次扣费）
            if (typeof startBillingSession === 'function') startBillingSession();

            try {
                const result = await this._currentTeam.run(goal);
                this._isRunning = false;
                this._showResultView(result);
            } catch (err) {
                this._isRunning = false;
                // 💰 失败退还预扣费用
                if (teamBillingDone && typeof Billing !== 'undefined') {
                    try {
                        await Billing.releaseFilm(currentUser.id, teamBillingId, estCost);
                        if (typeof refreshBalance === 'function') refreshBalance();
                    } catch (re) { console.warn('[AgentUI] 退款失败:', re.message); }
                }
                if (err.message !== '任务已取消') {
                    this._addMessage('system', 'error', `❌ 执行失败: ${err.message}`);
                }
            } finally {
                if (typeof endBillingSession === 'function') endBillingSession();
            }
        },

        /** 渲染运行视图 */
        _renderRunningView() {
            const runArea = document.getElementById('atRunArea');
            if (!runArea || !this._currentTeam) return;

            const agents = this._currentTeam.getAgentStates();

            runArea.innerHTML = `
                <div class="at-run-header">
                    <div class="at-run-title">${this._currentTeam.icon} ${this._currentTeam.name}</div>
                    <button class="at-btn at-btn-danger" onclick="AgentUI.cancelTeam()">⏹ 停止</button>
                </div>
                <div class="at-agents-bar" id="atAgentsBar">
                    ${agents.map(a => `
                        <div class="at-agent-avatar" id="atAgent_${a.id}" title="${a.name}">
                            <span class="at-agent-icon">${a.icon}</span>
                            <span class="at-agent-status-dot at-status-idle"></span>
                            <span class="at-agent-label">${a.name}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="at-message-flow" id="atMessageFlow"></div>
            `;
        },

        /** 绑定团队事件 */
        _bindTeamEvents() {
            if (!this._currentTeam) return;

            this._currentTeam.on('message', (msg) => {
                this._addMessage(msg.agentId, msg.type, msg.content, msg.agentIcon, msg.agentName);
            });

            this._currentTeam.on('agentUpdate', (states) => {
                this._updateAgentStates(states);
            });
        },

        /** 添加消息到流 */
        _addMessage(agentId, type, content, icon, name) {
            const flow = document.getElementById('atMessageFlow');
            if (!flow) return;

            const typeIcons = {
                thinking: '🧠', tool_call: '🔧', result: '✅',
                delegate: '📤', error: '❌', info: '📋'
            };

            const div = document.createElement('div');
            div.className = `at-msg at-msg-${type}`;
            div.innerHTML = `
                <span class="at-msg-icon">${icon || typeIcons[type] || '💬'}</span>
                <div class="at-msg-body">
                    <span class="at-msg-agent">${name || agentId}</span>
                    <span class="at-msg-text">${this._escapeHtml(content)}</span>
                </div>
                <span class="at-msg-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            `;
            flow.appendChild(div);
            flow.scrollTop = flow.scrollHeight;
        },

        /** 更新 Agent 状态 */
        _updateAgentStates(states) {
            for (const s of states) {
                const el = document.getElementById(`atAgent_${s.id}`);
                if (!el) continue;
                const dot = el.querySelector('.at-agent-status-dot');
                if (dot) {
                    dot.className = `at-agent-status-dot at-status-${s.status}`;
                }
            }
        },

        /** 取消执行 */
        cancelTeam() {
            if (this._currentTeam) {
                this._currentTeam.cancel();
                this._isRunning = false;
                this._addMessage('system', 'info', '🛑 已取消执行', '🛑', '系统');
            }
        },

        // ==================== 结果展示 ====================

        _showResultView(result) {
            this._showView('result');
            const resultArea = document.getElementById('atResultArea');
            if (!resultArea) return;

            const deliverables = result.deliverables || [];

            resultArea.innerHTML = `
                <div class="at-result-header">
                    <div class="at-result-title">✅ 任务完成</div>
                    <div class="at-result-stats">共 ${deliverables.length} 项交付物</div>
                </div>
                <div class="at-deliverables">
                    ${deliverables.map((d, i) => this._renderDeliverable(d, i)).join('')}
                </div>
                <div class="at-result-actions">
                    <button class="at-btn at-btn-secondary" onclick="AgentUI._showView('select')">🔄 新任务</button>
                    <button class="at-btn at-btn-secondary" onclick="AgentUI.showTeamHistory()">📂 历史</button>
                    <button class="at-btn at-btn-primary" onclick="AgentUI.close()">完成</button>
                </div>
            `;

            // 自动保存团队结果
            this._saveTeamResult(result);
        },

        _renderDeliverable(d, idx) {
            if (d.type === 'image') {
                return `
                    <div class="at-deliverable at-deliverable-image">
                        <div class="at-d-header">${d.icon || '🎨'} ${d.agent || ''} ${d.description || ''}</div>
                        <img src="${d.url}" alt="生成图片" class="at-d-img" onclick="window.open('${d.url}','_blank')">
                    </div>
                `;
            }
            if (d.type === 'video') {
                return `
                    <div class="at-deliverable at-deliverable-video">
                        <div class="at-d-header">${d.icon || '🎬'} ${d.agent || ''}</div>
                        <video src="${d.url}" controls class="at-d-video"></video>
                    </div>
                `;
            }
            if (d.type === 'text' || d.type === 'summary') {
                return `
                    <div class="at-deliverable at-deliverable-text">
                        <div class="at-d-header">${d.icon || '📝'} ${d.agent || ''}</div>
                        <div class="at-d-text">${this._escapeHtml(d.content || '').replace(/\n/g, '<br>')}</div>
                    </div>
                `;
            }
            return '';
        },

        // ==================== 团队结果持久化 ====================

        _TEAM_HISTORY_KEY: 'rollroll_team_history',
        _TEAM_HISTORY_MAX: 20,

        /** 保存团队执行结果 */
        _saveTeamResult(result) {
            try {
                const team = this._currentTeam;
                const tpl = this._selectedTemplate;
                const templates = typeof AgentTeamFactory !== 'undefined' ? AgentTeamFactory.getTemplates() : [];
                const tplInfo = templates.find(t => t.id === tpl);

                // 压缩 deliverables，过滤 base64
                const compactDeliverables = (result.deliverables || []).map(d => {
                    const c = { type: d.type, agent: d.agent, icon: d.icon, description: d.description };
                    if (d.url && !d.url.startsWith('data:')) c.url = d.url;
                    if (d.content) c.content = d.content.substring(0, 2000);
                    return c;
                });

                const record = {
                    id: Date.now(),
                    timestamp: Date.now(),
                    teamId: tpl || 'custom',
                    teamName: tplInfo?.name || team?.name || '自由团队',
                    teamIcon: tplInfo?.icon || team?.icon || '🤖',
                    goal: document.getElementById('atGoalInput')?.value?.trim() || '',
                    deliverables: compactDeliverables,
                    stats: {
                        totalDeliverables: (result.deliverables || []).length,
                        images: (result.deliverables || []).filter(d => d.type === 'image').length,
                        videos: (result.deliverables || []).filter(d => d.type === 'video').length,
                        texts: (result.deliverables || []).filter(d => d.type === 'text' || d.type === 'summary').length
                    }
                };

                let history = this._loadTeamHistory();
                history.unshift(record);
                if (history.length > this._TEAM_HISTORY_MAX) history.length = this._TEAM_HISTORY_MAX;

                // 防止 localStorage 配额溢出：写入失败时逐步裁剪
                let saved = false;
                while (!saved && history.length > 0) {
                    try {
                        localStorage.setItem(this._TEAM_HISTORY_KEY, JSON.stringify(history));
                        saved = true;
                    } catch (quotaErr) {
                        // 配额不足：去掉最旧的记录再重试
                        history.pop();
                        if (history.length === 0) {
                            // 还是不行就清空
                            try { localStorage.removeItem(this._TEAM_HISTORY_KEY); } catch (_) {}
                        }
                    }
                }
                console.log('💾 [AgentUI] 团队结果已保存');
            } catch (e) {
                console.warn('[AgentUI] 保存团队结果失败:', e);
            }
        },

        /** 加载团队历史 */
        _loadTeamHistory() {
            try {
                return JSON.parse(localStorage.getItem(this._TEAM_HISTORY_KEY) || '[]');
            } catch { return []; }
        },

        /** 删除单条团队历史 */
        deleteTeamHistoryItem(id) {
            const history = this._loadTeamHistory().filter(r => r.id !== id);
            localStorage.setItem(this._TEAM_HISTORY_KEY, JSON.stringify(history));
            this.showTeamHistory(); // 刷新列表
        },

        /** 显示团队历史列表 */
        showTeamHistory() {
            this._showView('result');
            const resultArea = document.getElementById('atResultArea');
            if (!resultArea) return;

            const history = this._loadTeamHistory();
            if (history.length === 0) {
                resultArea.innerHTML = `
                    <div style="text-align:center;padding:60px 20px;">
                        <div style="font-size:48px;margin-bottom:16px;">📂</div>
                        <div style="font-size:16px;color:#999;margin-bottom:8px;">还没有团队执行记录</div>
                        <div style="font-size:13px;color:#666;margin-bottom:24px;">使用团队完成任务后，结果会自动保存到这里</div>
                        <button class="at-btn at-btn-primary" onclick="AgentUI._showView('select')">🔄 去创建任务</button>
                    </div>
                `;
                return;
            }

            resultArea.innerHTML = `
                <div class="at-result-header">
                    <div class="at-result-title">📂 团队历史记录</div>
                    <div class="at-result-stats">${history.length} 条记录</div>
                </div>
                <div class="at-deliverables" style="gap:10px;">
                    ${history.map(r => {
                        const timeStr = new Date(r.timestamp).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
                        const statsArr = [];
                        if (r.stats?.images) statsArr.push(`🖼️${r.stats.images}`);
                        if (r.stats?.videos) statsArr.push(`🎬${r.stats.videos}`);
                        if (r.stats?.texts) statsArr.push(`📝${r.stats.texts}`);
                        const statsStr = statsArr.length ? statsArr.join(' ') : `${r.stats?.totalDeliverables || 0}项`;
                        const goalStr = (r.goal || '').substring(0, 50);
                        return `
                            <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:14px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);" onclick="AgentUI.viewTeamHistoryItem(${r.id})">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                                    <div style="font-size:14px;font-weight:600;color:#fff;">${r.teamIcon || '🤖'} ${r.teamName}</div>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <span style="font-size:11px;color:#666;">${timeStr}</span>
                                        <button onclick="event.stopPropagation();AgentUI.deleteTeamHistoryItem(${r.id})" style="background:none;border:none;color:#666;cursor:pointer;font-size:13px;padding:0 2px;" title="删除">✕</button>
                                    </div>
                                </div>
                                <div style="font-size:12px;color:#999;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${goalStr}</div>
                                <div style="font-size:12px;color:#a78bfa;">${statsStr}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="at-result-actions">
                    <button class="at-btn at-btn-secondary" onclick="AgentUI._showView('select')">🔄 新任务</button>
                    <button class="at-btn at-btn-primary" onclick="AgentUI.close()">关闭</button>
                </div>
            `;
        },

        /** 查看单条团队历史详情 */
        viewTeamHistoryItem(id) {
            const history = this._loadTeamHistory();
            const record = history.find(r => r.id === id);
            if (!record) { if (typeof showToast === 'function') showToast('记录未找到'); return; }

            this._showView('result');
            const resultArea = document.getElementById('atResultArea');
            if (!resultArea) return;

            const deliverables = record.deliverables || [];
            resultArea.innerHTML = `
                <div class="at-result-header">
                    <div class="at-result-title">${record.teamIcon || '🤖'} ${record.teamName}</div>
                    <div class="at-result-stats">${deliverables.length} 项交付物</div>
                </div>
                ${record.goal ? `<div style="font-size:13px;color:#999;padding:0 4px 8px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:8px;">🎯 ${this._escapeHtml(record.goal)}</div>` : ''}
                <div class="at-deliverables">
                    ${deliverables.map((d, i) => this._renderDeliverable(d, i)).join('')}
                </div>
                <div class="at-result-actions">
                    <button class="at-btn at-btn-secondary" onclick="AgentUI.showTeamHistory()">← 返回列表</button>
                    <button class="at-btn at-btn-secondary" onclick="AgentUI._showView('select')">🔄 新任务</button>
                    <button class="at-btn at-btn-primary" onclick="AgentUI.close()">关闭</button>
                </div>
            `;
        },

        // ==================== 工具函数 ====================
        _escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    };

    global.AgentUI = AgentUI;
    console.log('🖥️ [AgentUI] UI 组件已加载');

})(typeof window !== 'undefined' ? window : this);
