/**
 * 艾莉丝 (Alice) VSCode 扩展入口
 */

const vscode = require('vscode');
const { TaskOrchestrator } = require('../index');

let orchestrator;
let outputChannel;

function activate(context) {
    console.log('[艾莉丝] 插件激活');

    outputChannel = vscode.window.createOutputChannel('艾莉丝 (Alice)');

    const config = vscode.workspace.getConfiguration('alice');
    const servicesConfig = config.get('aiServices', []);
    const safetyMode = config.get('safetyMode', true);

    orchestrator = new TaskOrchestrator({
        safetyOptions: { safetyMode }
    });

    if (servicesConfig.length > 0) {
        orchestrator.initialize(servicesConfig);
    }

    let startCommand = vscode.commands.registerCommand('alice.start', async function () {
        const userInput = await vscode.window.showInputBox({
            prompt: '请告诉艾莉丝您的需求',
            placeHolder: '例如：帮我写一个排序函数'
        });

        if (userInput) {
            await handleUserRequest(userInput);
        }
    });

    let configureCommand = vscode.commands.registerCommand('alice.configure', function () {
        vscode.commands.executeCommand('workbench.action.openSettings', 'alice');
    });

    let codeReviewCommand = vscode.commands.registerCommand('alice.codeReview', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection) || editor.document.getText();
        await handleUserRequest('请审查这段代码', {
            selectedCode,
            language: editor.document.languageId,
            filePath: editor.document.uri.fsPath,
            originalCode: selectedCode
        });
    });

    context.subscriptions.push(startCommand, configureCommand, codeReviewCommand);

    outputChannel.appendLine('[艾莉丝] 插件已激活');
}

async function handleUserRequest(userInput, context = {}) {
    outputChannel.appendLine(`[艾莉丝] 处理请求: ${userInput}`);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    statusBarItem.text = '$(loading~spin) 艾莉丝思考中...';
    statusBarItem.show();

    try {
        const editor = vscode.window.activeTextEditor;
        if (editor && !context.selectedCode) {
            context.selectedCode = editor.document.getText(editor.selection);
            context.language = editor.document.languageId;
            context.filePath = editor.document.uri.fsPath;
            context.fileContent = editor.document.getText();
        }

        const result = await orchestrator.processRequest(userInput, context);

        outputChannel.appendLine(`[艾莉丝] 结果类型: ${result.type}`);

        if (result.type === 'intent_confirmation') {
            const confirmed = await vscode.window.showQuickPick(['确认', '取消'], {
                placeHolder: result.message
            });

            if (confirmed === '确认') {
                await orchestrator.executeTask(result.intent, userInput, context);
            }
        } else if (result.type === 'success') {
            await handleSuccessResult(result, context);
        } else if (result.type === 'error') {
            vscode.window.showErrorMessage(`错误: ${result.error}`);
            outputChannel.appendLine(`[艾莉丝] 错误: ${result.error}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`执行失败: ${error.message}`);
        outputChannel.appendLine(`[艾莉丝] 执行失败: ${error.stack}`);
    } finally {
        statusBarItem.dispose();
    }
}

async function handleSuccessResult(result, context) {
    const { intent, service, result: taskResult, rawResponse } = result;

    outputChannel.appendLine(`[艾莉丝] 使用服务: ${service.name}`);
    outputChannel.appendLine(`[艾莉丝] 意图: ${intent.taskType}`);

    if (taskResult.type === 'requires_approval') {
        await showApprovalDialog(taskResult.approvalRequest);
    } else {
        await showContentResult(taskResult, context);
    }
}

async function showApprovalDialog(approvalRequest) {
    const { safetyCheck, diff, originalCode, proposedCode, description } = approvalRequest;

    let message = `艾莉丝准备${description}\n\n`;
    
    if (safetyCheck.warnings.length > 0) {
        message += '⚠️ 警告:\n';
        for (const warning of safetyCheck.warnings) {
            message += `- ${warning.message}\n`;
        }
        message += '\n';
    }

    message += `变更统计: ${safetyCheck.changeSummary.addedLines} 行新增, ${safetyCheck.changeSummary.removedLines} 行删除`;

    const action = await vscode.window.showQuickPick(
        ['查看详情', '批准修改', '拒绝修改'],
        { placeHolder: message }
    );

    if (action === '查看详情') {
        const diffContent = formatDiff(diff);
        const doc = await vscode.workspace.openTextDocument({
            content: diffContent,
            language: 'diff'
        });
        await vscode.window.showTextDocument(doc);
        
        const finalAction = await vscode.window.showQuickPick(['批准修改', '拒绝修改']);
        if (finalAction === '批准修改') {
            applyModification(approvalRequest);
        } else {
            orchestrator.rejectModification(approvalRequest.id);
        }
    } else if (action === '批准修改') {
        applyModification(approvalRequest);
    } else {
        orchestrator.rejectModification(approvalRequest.id);
        vscode.window.showInformationMessage('已拒绝修改');
    }
}

function formatDiff(diff) {
    return diff.map(line => {
        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
        return `${prefix}${line.content}`;
    }).join('\n');
}

function applyModification(approvalRequest) {
    orchestrator.approveModification(approvalRequest.id);
    
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length)
        );
        editor.edit(editBuilder => {
            editBuilder.replace(fullRange, approvalRequest.proposedCode);
        });
        vscode.window.showInformationMessage('修改已应用');
    }
}

async function showContentResult(taskResult, context) {
    const { content, codeBlocks } = taskResult;

    outputChannel.appendLine('[艾莉丝] 响应:');
    outputChannel.appendLine(content);
    outputChannel.show(true);

    if (codeBlocks.length > 0) {
        const insertAction = await vscode.window.showQuickPick(
            ['在输出面板查看', '插入代码'],
            { placeHolder: '检测到代码块，是否插入？' }
        );

        if (insertAction === '插入代码') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const code = codeBlocks[0].code;
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, code);
                });
            }
        }
    }
}

function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
    console.log('[艾莉丝] 插件已停用');
}

module.exports = {
    activate,
    deactivate
};
