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

            // 💰 获取估算费用
            const templates = typeof AgentTeamFactory !== 'undefined' ? AgentTeamFactory.getTemplates() : [];
            const tpl = templates.find(t => t.id === this._selectedTemplate);
            const filmCost = tpl?.estimatedCost || 8; // 默认8胶片

            // 💰 检查登录和余额
            if (typeof currentUser !== 'undefined' && !currentUser) {
                if (typeof showToast === 'function') showToast('请先登录后再使用团队功能');
                return;
            }
            if (typeof userQuota !== 'undefined' && userQuota < filmCost) {
                if (typeof showToast === 'function') showToast(`胶片不足，需要约${filmCost}胶片，当前${userQuota}`);
                return;
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

            // 💰 包裹执行函数（带计费）
            const teamApiCall = () => this._currentTeam.run(goal);

            try {
                let result;
                if (filmCost > 0 && typeof Billing !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                    result = await Billing.executeWithBilling({
                        userId: currentUser.id,
                        filmCost: filmCost,
                        apiCall: teamApiCall,
                        onBalanceUpdate: (newBalance) => {
                            if (typeof userQuota !== 'undefined') {
                                window.userQuota = parseFloat(newBalance) || 0;
                                localStorage.setItem('film_balance', String(window.userQuota));
                            }
                            if (typeof updateQuotaDisplay === 'function') updateQuotaDisplay();
                        },
                        description: `Agent团队: ${tpl?.name || '自由团队'}`
                    });
                } else {
                    result = await teamApiCall();
                }
                this._isRunning = false;
                this._showResultView(result);
            } catch (err) {
                this._isRunning = false;
                if (err.message !== '任务已取消') {
                    this._addMessage('system', 'error', `❌ 执行失败: ${err.message}`);
                }
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
                    <button class="at-btn at-btn-primary" onclick="AgentUI.close()">完成</button>
                </div>
            `;
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

        // ==================== 工具函数 ====================
        _escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    };

    global.AgentUI = AgentUI;
    console.log('🖥️ [AgentUI] UI 组件已加载');

})(typeof window !== 'undefined' ? window : this);
