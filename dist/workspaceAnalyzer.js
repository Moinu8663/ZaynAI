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
exports.WorkspaceAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class WorkspaceAnalyzer {
    async buildContext(includeWorkspace, userPrompt = "") {
        const editor = vscode.window.activeTextEditor;
        const active = editor
            ? `Active file: ${editor.document.fileName}
Language: ${editor.document.languageId}
${editor.document.getText().slice(0, 16000)}`
            : "No active editor.";
        const config = vscode.workspace.getConfiguration("zaynai");
        const autoFetch = config.get("autoFetchExplorerFiles", true);
        if (!includeWorkspace || !autoFetch || !vscode.workspace.workspaceFolders?.length) {
            return active;
        }
        const maxFiles = config.get("maxWorkspaceFiles", 80);
        const maxChars = config.get("maxFileChars", 12000);
        const folder = vscode.workspace.workspaceFolders[0];
        const pattern = new vscode.RelativePattern(folder, "**/*.{ts,tsx,js,jsx,cs,sql,json,md,yml,yaml,xml,csproj,sln,html,css,scss}");
        const uris = await vscode.workspace.findFiles(pattern, "**/{node_modules,.git,dist,build,coverage,bin,obj}/**", 500);
        const activeUri = editor?.document.uri;
        const promptTerms = this.terms(userPrompt);
        const orderedUris = uris
            .filter(uri => uri.toString() !== activeUri?.toString())
            .sort((left, right) => this.relevance(right, folder, promptTerms) - this.relevance(left, folder, promptTerms))
            .slice(0, maxFiles);
        const sections = [
            active,
            "\nRelevant Explorer files (automatically selected):"
        ];
        for (const uri of orderedUris) {
            try {
                const bytes = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(bytes)
                    .toString("utf8")
                    .slice(0, maxChars);
                sections.push(`\n--- ${path.relative(folder.uri.fsPath, uri.fsPath)} ---\n${text}`);
            }
            catch {
                // Ignore unreadable files.
            }
        }
        return sections.join("\n");
    }
    terms(prompt) {
        return [...new Set((prompt.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) ?? [])
                .filter(term => !["that", "this", "with", "from", "file", "code", "please", "create", "build"].includes(term)))];
    }
    relevance(uri, folder, terms) {
        const name = path.relative(folder.uri.fsPath, uri.fsPath).toLowerCase();
        return terms.reduce((score, term) => score + (name.includes(term) ? 10 : 0), 0);
    }
}
exports.WorkspaceAnalyzer = WorkspaceAnalyzer;
//# sourceMappingURL=workspaceAnalyzer.js.map