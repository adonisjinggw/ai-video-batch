const vscode = require('vscode');

function activate(context) {
    console.log('[艾莉丝] 插件激活 - 最简版');

    let disposable = vscode.commands.registerCommand('alice.start', function () {
        vscode.window.showInformationMessage('🌸 艾莉丝已启动！插件运行正常。');
    });

    let configCmd = vscode.commands.registerCommand('alice.configure', function () {
        vscode.window.showInformationMessage('🌸 艾莉丝配置功能开发中...');
    });

    let reviewCmd = vscode.commands.registerCommand('alice.codeReview', function () {
        vscode.window.showInformationMessage('🌸 艾莉丝代码审查功能开发中...');
    });

    context.subscriptions.push(disposable, configCmd, reviewCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
