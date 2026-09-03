"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const aiService_1 = require("./aiService");
const workspaceAnalyzer_1 = require("./workspaceAnalyzer");
const webview_1 = require("./webview");
const assistantResult_1 = require("./assistantResult");
const workspaceEditor_1 = require("./workspaceEditor");
const authService_1 = require("./authService");
let lastResponse = "";
let pendingChanges = [];
function activate(context) {
    const auth = new authService_1.AuthService(context);
    const ai = new aiService_1.AiService(auth);
    const analyzer = new workspaceAnalyzer_1.WorkspaceAnalyzer();
    const workspaceEditor = new workspaceEditor_1.WorkspaceEditor();
    const view = new webview_1.DevAssistantView(context.extensionUri, auth, async (request) => {
        return requestAssistant(ai, analyzer, workspaceEditor, request.area, request.prompt, request.selectedCode, request.includeWorkspace, undefined, request.history);
    });
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("zaynai.chat", view), vscode.commands.registerCommand("zaynai.ask", () => runPrompt(ai, analyzer, workspaceEditor, "General")), vscode.commands.registerCommand("zaynai.analyzeWorkspace", () => runPrompt(ai, analyzer, workspaceEditor, "Architecture")), vscode.commands.registerCommand("zaynai.explainCode", () => selectedAction(ai, analyzer, workspaceEditor, "Coding", "Explain this code and identify risks or improvement opportunities.")), vscode.commands.registerCommand("zaynai.reviewCode", () => selectedAction(ai, analyzer, workspaceEditor, "Code Review", "Perform a production-grade code review covering correctness, maintainability, security and performance.")), vscode.commands.registerCommand("zaynai.generateTests", () => selectedAction(ai, analyzer, workspaceEditor, "Testing", "Generate appropriate unit/integration tests for the selected code. Detect the test framework from the workspace.")), vscode.commands.registerCommand("zaynai.fixError", () => runPrompt(ai, analyzer, workspaceEditor, "Debugging")), vscode.commands.registerCommand("zaynai.architecture", () => runPrompt(ai, analyzer, workspaceEditor, "Architecture")), vscode.commands.registerCommand("zaynai.security", () => runPrompt(ai, analyzer, workspaceEditor, "Security")), vscode.commands.registerCommand("zaynai.performance", () => runPrompt(ai, analyzer, workspaceEditor, "Performance")), vscode.commands.registerCommand("zaynai.migration", () => runPrompt(ai, analyzer, workspaceEditor, "Migration")), vscode.commands.registerCommand("zaynai.devops", () => runPrompt(ai, analyzer, workspaceEditor, "DevOps")), vscode.commands.registerCommand("zaynai.database", () => runPrompt(ai, analyzer, workspaceEditor, "Database")), vscode.commands.registerCommand("zaynai.documentation", () => runPrompt(ai, analyzer, workspaceEditor, "Documentation")), vscode.commands.registerCommand("zaynai.uiux", () => runPrompt(ai, analyzer, workspaceEditor, "UI/UX")), vscode.commands.registerCommand("zaynai.automation", () => runPrompt(ai, analyzer, workspaceEditor, "Automation")), vscode.commands.registerCommand("zaynai.signIn", async () => {
        await auth.signInWithPrompts();
        view.refreshAccount();
    }), vscode.commands.registerCommand("zaynai.signUp", async () => {
        await auth.signUpWithPrompts();
        view.refreshAccount();
    }), vscode.commands.registerCommand("zaynai.signOut", async () => {
        await auth.signOut();
        view.refreshAccount();
        vscode.window.showInformationMessage("Signed out of ZaynAI.");
    }), vscode.commands.registerCommand("zaynai.manageSubscription", async () => {
        await auth.openSubscriptionPortal();
    }), vscode.commands.registerCommand("zaynai.previewGeneratedChanges", () => previewGeneratedChanges(pendingChanges)), vscode.commands.registerCommand("zaynai.applyGeneratedChanges", async () => {
        if (!pendingChanges.length) {
            vscode.window.showInformationMessage("No generated file changes are waiting for review.");
            return;
        }
        const result = await workspaceEditor.apply(pendingChanges);
        if (result.applied.length) {
            pendingChanges = pendingChanges.filter(change => !result.applied.includes(change.path));
            vscode.window.showInformationMessage(`Applied ${result.applied.length} generated file change(s).`);
        }
        if (result.errors.length)
            vscode.window.showErrorMessage(result.errors.join("\n"));
    }), vscode.commands.registerCommand("zaynai.insertResponse", async () => {
        if (!lastResponse) {
            vscode.window.showInformationMessage("No AI response available yet.");
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        await editor.edit(e => e.insert(editor.selection.active, lastResponse));
    }));
}
async function runPrompt(ai, analyzer, workspaceEditor, area) {
    try {
        await ai.auth.ensureActiveAccount();
    }
    catch (err) {
        vscode.window.showErrorMessage(String(err));
        return;
    }
    const prompt = await vscode.window.showInputBox({
        title: `${area} — ZaynAI`,
        prompt: "Describe what you need help with",
        placeHolder: "Example: Optimize this API and explain the bottleneck."
    });
    if (!prompt)
        return;
    const selected = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection) || "";
    const context = await analyzer.buildContext(true, prompt);
    try {
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `ZaynAI: ${area}`
        }, () => requestAssistant(ai, analyzer, workspaceEditor, area, prompt, selected, true, context));
        lastResponse = displayResult(result);
        const doc = await vscode.workspace.openTextDocument({
            content: lastResponse,
            language: "markdown"
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    }
    catch (error) {
        vscode.window.showErrorMessage(String(error));
    }
}
async function selectedAction(ai, analyzer, workspaceEditor, area, instruction) {
    try {
        await ai.auth.ensureActiveAccount();
    }
    catch (err) {
        vscode.window.showErrorMessage(String(err));
        return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage("Select code first.");
        return;
    }
    const selected = editor.document.getText(editor.selection);
    const context = await analyzer.buildContext(true, instruction);
    try {
        const result = await requestAssistant(ai, analyzer, workspaceEditor, area, instruction, selected, true, context);
        lastResponse = displayResult(result);
        const doc = await vscode.workspace.openTextDocument({
            content: lastResponse,
            language: "markdown"
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    }
    catch (error) {
        vscode.window.showErrorMessage(String(error));
    }
}
function deactivate() { }
async function requestAssistant(ai, analyzer, workspaceEditor, area, prompt, selectedCode, includeWorkspace, existingContext, history = []) {
    const context = existingContext ?? await analyzer.buildContext(includeWorkspace, prompt);
    const raw = await ai.ask(area, prompt, context, selectedCode, history);
    const result = (0, assistantResult_1.parseAssistantResult)(raw);
    const autoApply = vscode.workspace
        .getConfiguration("zaynai")
        .get("autoApplyGeneratedChanges", true);
    pendingChanges = result.changes;
    const application = autoApply && result.changes.length
        ? await workspaceEditor.apply(result.changes)
        : { applied: [], errors: [], added: 0, removed: 0 };
    return { ...result, appliedChanges: application.applied, applyErrors: application.errors, changeStats: { added: application.added, removed: application.removed } };
}
async function previewGeneratedChanges(changes) {
    if (!changes.length) {
        vscode.window.showInformationMessage("No generated file changes are waiting for review.");
        return;
    }
    let selected;
    if (changes.length === 1) {
        selected = changes[0];
    }
    else {
        const choice = await vscode.window.showQuickPick(changes.map(change => ({ label: change.path, description: change.description ?? "Generated update", change })), { title: "ZaynAI — Preview generated file change", placeHolder: "Choose a proposed file" });
        if (!choice)
            return;
        selected = choice.change;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showWarningMessage("Open a workspace before previewing generated changes.");
        return;
    }
    const targetPath = path.resolve(folder.uri.fsPath, selected.path);
    const relative = path.relative(folder.uri.fsPath, targetPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        vscode.window.showErrorMessage("Generated path must stay inside the workspace.");
        return;
    }
    const target = vscode.Uri.file(targetPath);
    const existing = await vscode.workspace.fs.stat(target).then(() => target, () => undefined);
    const original = existing
        ? await vscode.workspace.openTextDocument(existing)
        : await vscode.workspace.openTextDocument({ content: "", language: languageFor(selected.path) });
    const proposed = await vscode.workspace.openTextDocument({
        content: selected.content,
        language: languageFor(selected.path)
    });
    await vscode.commands.executeCommand("vscode.diff", original.uri, proposed.uri, `ZaynAI: ${selected.path} (proposed)`);
}
function languageFor(file) {
    const extension = file.split(".").pop()?.toLowerCase();
    return { ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact", cs: "csharp", py: "python", json: "json", md: "markdown" }[extension ?? ""] ?? "plaintext";
}
function displayResult(result) {
    const status = result.appliedChanges.length
        ? `\n\nApplied files:\n${result.appliedChanges.map(file => `- ${file}`).join("\n")}`
        : "";
    const errors = result.applyErrors.length ? `\n\nApply errors:\n${result.applyErrors.join("\n")}` : "";
    return `${result.summary}${status}${errors}`;
}
//# sourceMappingURL=extension.js.map