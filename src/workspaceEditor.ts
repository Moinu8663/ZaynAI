import * as path from "path";
import * as vscode from "vscode";
import { GeneratedChange } from "./assistantResult";

export class WorkspaceEditor {
  async apply(changes: GeneratedChange[]): Promise<{ applied: string[]; errors: string[]; added: number; removed: number }> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return { applied: [], errors: ["Open a workspace before applying generated changes."], added: 0, removed: 0 };
    if (!vscode.workspace.isTrusted) return { applied: [], errors: ["Trust this workspace before applying generated changes."], added: 0, removed: 0 };

    const applied: string[] = [];
    const errors: string[] = [];
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
      } catch (error) {
        errors.push(`${change.path}: ${String(error)}`);
      }
    }

    return { applied, errors, added, removed };
  }

  private resolveWorkspaceFile(folder: vscode.WorkspaceFolder, requestedPath: string): vscode.Uri {
    const root = folder.uri.fsPath;
    const target = path.resolve(root, requestedPath);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Generated path must stay inside the workspace.");
    }

    return vscode.Uri.file(target);
  }

  private lineChanges(before: string, after: string): { added: number; removed: number } {
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
