import * as vscode from "vscode";
import * as path from "path";

export class WorkspaceAnalyzer {
  async buildContext(includeWorkspace: boolean, userPrompt = ""): Promise<string> {
    const editor = vscode.window.activeTextEditor;

    const active = editor
      ? `Active file: ${editor.document.fileName}
Language: ${editor.document.languageId}
${editor.document.getText().slice(0, 16000)}`
      : "No active editor.";

    const config = vscode.workspace.getConfiguration("zaynai");
    const autoFetch = config.get<boolean>("autoFetchExplorerFiles", true);

    if (!includeWorkspace || !autoFetch || !vscode.workspace.workspaceFolders?.length) {
      return active;
    }

    const maxFiles = config.get<number>("maxWorkspaceFiles", 80);
    const maxChars = config.get<number>("maxFileChars", 12000);

    const folder = vscode.workspace.workspaceFolders[0];

    const pattern = new vscode.RelativePattern(
      folder,
      "**/*.{ts,tsx,js,jsx,cs,sql,json,md,yml,yaml,xml,csproj,sln,html,css,scss}"
    );

    const uris = await vscode.workspace.findFiles(
      pattern,
      "**/{node_modules,.git,dist,build,coverage,bin,obj}/**",
      500
    );

    const activeUri = editor?.document.uri;
    const promptTerms = this.terms(userPrompt);
    const orderedUris = uris
      .filter(uri => uri.toString() !== activeUri?.toString())
      .sort((left, right) => this.relevance(right, folder, promptTerms) - this.relevance(left, folder, promptTerms))
      .slice(0, maxFiles);

    const sections: string[] = [
      active,
      "\nRelevant Explorer files (automatically selected):"
    ];

    for (const uri of orderedUris) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(bytes)
          .toString("utf8")
          .slice(0, maxChars);

        sections.push(
          `\n--- ${path.relative(folder.uri.fsPath, uri.fsPath)} ---\n${text}`
        );
      } catch {
        // Ignore unreadable files.
      }
    }

    return sections.join("\n");
  }

  private terms(prompt: string): string[] {
    return [...new Set((prompt.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) ?? [])
      .filter(term => !["that", "this", "with", "from", "file", "code", "please", "create", "build"].includes(term)))];
  }

  private relevance(uri: vscode.Uri, folder: vscode.WorkspaceFolder, terms: string[]): number {
    const name = path.relative(folder.uri.fsPath, uri.fsPath).toLowerCase();
    return terms.reduce((score, term) => score + (name.includes(term) ? 10 : 0), 0);
  }
}
