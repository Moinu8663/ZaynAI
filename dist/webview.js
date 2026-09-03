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
exports.DevAssistantView = void 0;
const vscode = __importStar(require("vscode"));
const crypto = __importStar(require("crypto"));
const webviewStyles_1 = require("./webviewStyles");
const webviewBody_1 = require("./webviewBody");
const webviewScript_1 = require("./webviewScript");
class DevAssistantView {
    extensionUri;
    auth;
    handler;
    view;
    conversationHistory = [];
    constructor(extensionUri, auth, handler) {
        this.extensionUri = extensionUri;
        this.auth = auth;
        this.handler = handler;
    }
    resolveWebviewView(view) {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.html();
        this.refreshAccount();
        view.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case "signIn": {
                    try {
                        const user = await this.auth.signInDirect(message.email, message.password);
                        const caps = await this.auth.getCapabilities();
                        view.webview.postMessage({ type: "authSuccess", user, caps });
                    }
                    catch (err) {
                        view.webview.postMessage({ type: "authError", text: String(err).replace("Error: ", "") });
                    }
                    break;
                }
                case "signUp": {
                    try {
                        const user = await this.auth.signUpDirect(message.name, message.email, message.password, message.planId);
                        const caps = await this.auth.getCapabilities();
                        view.webview.postMessage({ type: "authSuccess", user, caps });
                    }
                    catch (err) {
                        view.webview.postMessage({ type: "authError", text: String(err).replace("Error: ", "") });
                    }
                    break;
                }
                case "loadPlans": {
                    try {
                        const plans = await this.auth.getPlans();
                        view.webview.postMessage({ type: "plans", plans });
                    }
                    catch {
                        view.webview.postMessage({ type: "plans", plans: [] });
                    }
                    break;
                }
                case "signOut":
                    await vscode.commands.executeCommand("zaynai.signOut");
                    break;
                case "manageSubscription":
                    await vscode.commands.executeCommand("zaynai.manageSubscription");
                    break;
                case "refreshAccount":
                    await this.refreshAccount();
                    break;
                case "previewChanges":
                    await vscode.commands.executeCommand("zaynai.previewGeneratedChanges");
                    break;
                case "clearHistory":
                    this.conversationHistory = [];
                    break;
                case "ask": {
                    const userPrompt = message.request.prompt;
                    this.conversationHistory.push({ role: "user", content: userPrompt });
                    try {
                        const result = await this.handler({
                            ...message.request,
                            history: this.conversationHistory.slice(-12)
                        });
                        const assistantText = this.displayResult(result);
                        this.conversationHistory.push({ role: "assistant", content: assistantText });
                        view.webview.postMessage({
                            type: "result",
                            text: assistantText,
                            findings: result.findings,
                            appliedChanges: result.appliedChanges,
                            applyErrors: result.applyErrors,
                            changeStats: result.changeStats,
                            proposedChanges: result.changes.length - result.appliedChanges.length
                        });
                        await this.refreshAccount();
                    }
                    catch (error) {
                        this.conversationHistory.pop();
                        view.webview.postMessage({ type: "error", text: String(error).replace("Error: ", "") });
                    }
                    break;
                }
            }
        });
    }
    async refreshAccount() {
        const webview = this.view?.webview;
        if (!webview)
            return;
        const user = await this.auth.getCurrentUser().catch(() => undefined);
        const caps = user ? await this.auth.getCapabilities().catch(() => undefined) : undefined;
        webview.postMessage({ type: "account", user: user ?? null, caps: caps ?? null });
    }
    displayResult(result) {
        const applied = result.appliedChanges.length
            ? `\n\nApplied files:\n${result.appliedChanges.map(f => `- ${f}`).join("\n")}` : "";
        const errors = result.applyErrors.length
            ? `\n\nApply errors:\n${result.applyErrors.join("\n")}` : "";
        return `${result.summary}${applied}${errors}`;
    }
    html() {
        const nonce = crypto.randomBytes(16).toString("base64");
        return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${webviewStyles_1.WEBVIEW_STYLES}</style>
</head>
<body>
${webviewBody_1.WEBVIEW_BODY}
<script nonce="${nonce}">${webviewScript_1.WEBVIEW_SCRIPT}</script>
</body>
</html>`;
    }
}
exports.DevAssistantView = DevAssistantView;
//# sourceMappingURL=webview.js.map