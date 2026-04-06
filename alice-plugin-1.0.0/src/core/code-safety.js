/**
 * 代码安全检查模块 - 防止AI乱改代码
 */

class CodeSafetyChecker {
    constructor(options = {}) {
        this.safetyMode = options.safetyMode !== false;
        this.maxChangeRatio = options.maxChangeRatio || 0.3;
        this.requiredConfirmation = options.requiredConfirmation !== false;
        this.protectedPatterns = [
            /^\s*(import|export|require)\s/i,
            /^\s*(const|let|var)\s+[\w$]+\s*=\s*require\s*\(/i,
            /process\.env\./i,
            /API_KEY|SECRET|TOKEN|PASSWORD/i,
            /module\.exports\s*=/i
        ];
        this.dangerousOperations = [
            /rm\s+-rf/i,
            /fs\.unlink|fs\.rm|fs\.rmdir/i,
            /exec\s*\(|spawn\s*\(/i,
            /eval\s*\(/i,
            /child_process/i
        ];
    }

    checkCodeModification(originalCode, proposedCode, options = {}) {
        const result = {
            safe: true,
            warnings: [],
            requiresConfirmation: this.requiredConfirmation,
            changeSummary: null
        };

        if (!this.safetyMode) {
            return result;
        }

        const changeAnalysis = this.analyzeChanges(originalCode, proposedCode);
        result.changeSummary = changeAnalysis;

        if (changeAnalysis.changeRatio > this.maxChangeRatio) {
            result.safe = false;
            result.warnings.push({
                type: 'EXCESSIVE_CHANGE',
                message: `代码变更比例 (${(changeAnalysis.changeRatio * 100).toFixed(1)}%) 超过安全阈值 (${(this.maxChangeRatio * 100).toFixed(1)}%)`,
                severity: 'high'
            });
        }

        const protectedPatternMatches = this.checkProtectedPatterns(originalCode, proposedCode);
        if (protectedPatternMatches.length > 0) {
            result.warnings.push(...protectedPatternMatches);
        }

        const dangerousMatches = this.checkDangerousOperations(proposedCode);
        if (dangerousMatches.length > 0) {
            result.safe = false;
            result.warnings.push(...dangerousMatches);
        }

        const syntaxCheck = this.checkSyntax(proposedCode, options.language);
        if (!syntaxCheck.valid) {
            result.safe = false;
            result.warnings.push({
                type: 'SYNTAX_ERROR',
                message: `语法错误: ${syntaxCheck.error}`,
                severity: 'high'
            });
        }

        result.requiresConfirmation = result.requiresConfirmation || result.warnings.some(w => w.severity === 'high');

        return result;
    }

    analyzeChanges(originalCode, proposedCode) {
        const originalLines = originalCode.split('\n');
        const proposedLines = proposedCode.split('\n');

        let addedLines = 0;
        let removedLines = 0;
        let modifiedLines = 0;

        const originalSet = new Set(originalLines);
        const proposedSet = new Set(proposedLines);

        for (const line of originalLines) {
            if (!proposedSet.has(line)) {
                removedLines++;
            }
        }

        for (const line of proposedLines) {
            if (!originalSet.has(line)) {
                addedLines++;
            }
        }

        const totalOriginalLines = originalLines.length;
        const totalChangedLines = addedLines + removedLines;
        const changeRatio = totalOriginalLines > 0 ? totalChangedLines / totalOriginalLines : 1;

        return {
            originalLines: totalOriginalLines,
            proposedLines: proposedLines.length,
            addedLines,
            removedLines,
            totalChangedLines,
            changeRatio
        };
    }

    checkProtectedPatterns(originalCode, proposedCode) {
        const warnings = [];

        for (const pattern of this.protectedPatterns) {
            const originalMatches = [...originalCode.matchAll(pattern)];
            const proposedMatches = [...proposedCode.matchAll(pattern)];

            if (originalMatches.length > 0 && proposedMatches.length !== originalMatches.length) {
                warnings.push({
                    type: 'PROTECTED_PATTERN_CHANGE',
                    message: `检测到可能修改受保护的代码模式: ${pattern}`,
                    severity: 'medium'
                });
            }
        }

        return warnings;
    }

    checkDangerousOperations(code) {
        const warnings = [];

        for (const pattern of this.dangerousOperations) {
            if (pattern.test(code)) {
                warnings.push({
                    type: 'DANGEROUS_OPERATION',
                    message: `检测到危险操作: ${pattern}`,
                    severity: 'high'
                });
            }
        }

        return warnings;
    }

    checkSyntax(code, language = 'javascript') {
        try {
            if (language === 'javascript' || language === 'js') {
                new Function(code);
            }
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    generateDiffPreview(originalCode, proposedCode) {
        const originalLines = originalCode.split('\n');
        const proposedLines = proposedCode.split('\n');

        const diff = [];
        let i = 0, j = 0;

        while (i < originalLines.length || j < proposedLines.length) {
            if (i < originalLines.length && j < proposedLines.length && originalLines[i] === proposedLines[j]) {
                diff.push({ type: 'unchanged', content: originalLines[i], lineNumber: i + 1 });
                i++;
                j++;
            } else {
                let foundMatch = false;
                
                for (let k = j + 1; k < Math.min(j + 5, proposedLines.length); k++) {
                    if (i < originalLines.length && originalLines[i] === proposedLines[k]) {
                        for (let m = j; m < k; m++) {
                            diff.push({ type: 'added', content: proposedLines[m], lineNumber: m + 1 });
                        }
                        j = k;
                        foundMatch = true;
                        break;
                    }
                }

                if (!foundMatch) {
                    for (let k = i + 1; k < Math.min(i + 5, originalLines.length); k++) {
                        if (j < proposedLines.length && originalLines[k] === proposedLines[j]) {
                            for (let m = i; m < k; m++) {
                                diff.push({ type: 'removed', content: originalLines[m], lineNumber: m + 1 });
                            }
                            i = k;
                            foundMatch = true;
                            break;
                        }
                    }
                }

                if (!foundMatch) {
                    if (i < originalLines.length) {
                        diff.push({ type: 'removed', content: originalLines[i], lineNumber: i + 1 });
                        i++;
                    }
                    if (j < proposedLines.length) {
                        diff.push({ type: 'added', content: proposedLines[j], lineNumber: j + 1 });
                        j++;
                    }
                }
            }
        }

        return diff;
    }

    createApprovalRequest(originalCode, proposedCode, description, aiService) {
        const safetyCheck = this.checkCodeModification(originalCode, proposedCode);
        const diff = this.generateDiffPreview(originalCode, proposedCode);

        return {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            description,
            aiService,
            safetyCheck,
            diff,
            originalCode,
            proposedCode,
            status: 'pending',
            approver: null,
            approvedAt: null
        };
    }
}

module.exports = CodeSafetyChecker;
