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
exports.WorkspaceEditor = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class WorkspaceEditor {
    async apply(changes) {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder)
            return { applied: [], errors: ["Open a workspace before applying generated changes."], added: 0, removed: 0 };
        if (!vscode.workspace.isTrusted)
            return { applied: [], errors: ["Trust this workspace before applying generated changes."], added: 0, removed: 0 };
        const applied = [];
        const errors = [];
        let added = 0;
        let removed = 0;
        for (const change of changes.slice(0, 20)) {
            try {
                const uri = this.resolveWorkspaceFile(folder, change.path);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
                const before = await vscode.workspace.fs.readFile(uri)
                    .then(bytes => Buffer.from(bytes).toString("utf8"), () => "");
                const stats = this.lineChanges(before, change.content);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(change.content, "utf8"));
                applied.push(change.path);
                added += stats.added;
                removed += stats.removed;
            }
            catch (error) {
                errors.push(`${change.path}: ${String(error)}`);
            }
        }
        return { applied, errors, added, removed };
    }
    resolveWorkspaceFile(folder, requestedPath) {
        const root = folder.uri.fsPath;
        const target = path.resolve(root, requestedPath);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error("Generated path must stay inside the workspace.");
        }
        return vscode.Uri.file(target);
    }
    lineChanges(before, after) {
        const oldLines = before.split(/\r?\n/);
        const newLines = after.split(/\r?\n/);
        let previous = new Int32Array(newLines.length + 1);
        for (const oldLine of oldLines) {
            const current = new Int32Array(newLines.length + 1);
            for (let index = 1; index <= newLines.length; index++) {
                current[index] = oldLine === newLines[index - 1]
                    ? previous[index - 1] + 1
                    : Math.max(previous[index], current[index - 1]);
            }
            previous = current;
        }
        const unchanged = previous[newLines.length];
        return { added: newLines.length - unchanged, removed: oldLines.length - unchanged };
    }
}
exports.WorkspaceEditor = WorkspaceEditor;
//# sourceMappingURL=workspaceEditor.js.map