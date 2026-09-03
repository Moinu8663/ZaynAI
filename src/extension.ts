import * as vscode from "vscode";
import * as path from "path";
import { AiService, ConversationTurn } from "./aiService";
import { WorkspaceAnalyzer } from "./workspaceAnalyzer";
import { DevAssistantView } from "./webview";
import { AssistantResult, GeneratedChange, parseAssistantResult } from "./assistantResult";
import { WorkspaceEditor } from "./workspaceEditor";
import { AuthService } from "./authService";

let lastResponse = "";
let pendingChanges: GeneratedChange[] = [];

export function activate(context: vscode.ExtensionContext) {
  const auth = new AuthService(context);
  const ai = new AiService(auth);
  const analyzer = new WorkspaceAnalyzer();
  const workspaceEditor = new WorkspaceEditor();

  const view = new DevAssistantView(context.extensionUri, auth, async (request) => {
    return requestAssistant(ai, analyzer, workspaceEditor, request.area, request.prompt, request.selectedCode, request.includeWorkspace, undefined, request.history);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("zaynai.chat", view),

    vscode.commands.registerCommand("zaynai.ask", () =>
      runPrompt(ai, analyzer, workspaceEditor, "General")
    ),
    vscode.commands.registerCommand("zaynai.analyzeWorkspace", () =>
      runPrompt(ai, analyzer, workspaceEditor, "Architecture")
    ),
    vscode.commands.registerCommand("zaynai.explainCode", () =>
      selectedAction(ai, analyzer, workspaceEditor, "Coding", "Explain this code and identify risks or improvement opportunities.")
    ),
    vscode.commands.registerCommand("zaynai.reviewCode", () =>
      selectedAction(ai, analyzer, workspaceEditor, "Code Review", "Perform a production-grade code review covering correctness, maintainability, security and performance.")
    ),
    vscode.commands.registerCommand("zaynai.generateTests", () =>
      selectedAction(ai, analyzer, workspaceEditor, "Testing", "Generate appropriate unit/integration tests for the selected code. Detect the test framework from the workspace.")
    ),
    vscode.commands.registerCommand("zaynai.fixError", () => runPrompt(ai, analyzer, workspaceEditor, "Debugging")),
    vscode.commands.registerCommand("zaynai.architecture", () => runPrompt(ai, analyzer, workspaceEditor, "Architecture")),
    vscode.commands.registerCommand("zaynai.security", () => runPrompt(ai, analyzer, workspaceEditor, "Security")),
    vscode.commands.registerCommand("zaynai.performance", () => runPrompt(ai, analyzer, workspaceEditor, "Performance")),
    vscode.commands.registerCommand("zaynai.migration", () => runPrompt(ai, analyzer, workspaceEditor, "Migration")),
    vscode.commands.registerCommand("zaynai.devops", () => runPrompt(ai, analyzer, workspaceEditor, "DevOps")),
    vscode.commands.registerCommand("zaynai.database", () => runPrompt(ai, analyzer, workspaceEditor, "Database")),
    vscode.commands.registerCommand("zaynai.documentation", () => runPrompt(ai, analyzer, workspaceEditor, "Documentation")),
    vscode.commands.registerCommand("zaynai.uiux", () => runPrompt(ai, analyzer, workspaceEditor, "UI/UX")),
    vscode.commands.registerCommand("zaynai.automation", () => runPrompt(ai, analyzer, workspaceEditor, "Automation")),

    vscode.commands.registerCommand("zaynai.signIn", async () => {
      await auth.signInWithPrompts();
      view.refreshAccount();
    }),

    vscode.commands.registerCommand("zaynai.signUp", async () => {
      await auth.signUpWithPrompts();
      view.refreshAccount();
    }),

    vscode.commands.registerCommand("zaynai.signOut", async () => {
      await auth.signOut();
      view.refreshAccount();
      vscode.window.showInformationMessage("Signed out of ZaynAI.");
    }),

    vscode.commands.registerCommand("zaynai.manageSubscription", async () => {
      await auth.openSubscriptionPortal();
    }),

    vscode.commands.registerCommand("zaynai.previewGeneratedChanges", () =>
      previewGeneratedChanges(pendingChanges)
    ),

    vscode.commands.registerCommand("zaynai.applyGeneratedChanges", async () => {
      if (!pendingChanges.length) {
        vscode.window.showInformationMessage("No generated file changes are waiting for review.");
        return;
      }
      const result = await workspaceEditor.apply(pendingChanges);
      if (result.applied.length) {
        pendingChanges = pendingChanges.filter(change => !result.applied.includes(change.path));
        vscode.window.showInformationMessage(`Applied ${result.applied.length} generated file change(s).`);
      }
      if (result.errors.length) vscode.window.showErrorMessage(result.errors.join("\n"));
    }),

    vscode.commands.registerCommand("zaynai.insertResponse", async () => {
      if (!lastResponse) {
        vscode.window.showInformationMessage("No AI response available yet.");
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      await editor.edit(e => e.insert(editor.selection.active, lastResponse));
    })
  );
}

async function runPrompt(
  ai: AiService,
  analyzer: WorkspaceAnalyzer,
  workspaceEditor: WorkspaceEditor,
  area: string
) {
  try { await ai.auth.ensureActiveAccount(); } catch (err) { vscode.window.showErrorMessage(String(err)); return; }

  const prompt = await vscode.window.showInputBox({
    title: `${area} — ZaynAI`,
    prompt: "Describe what you need help with",
    placeHolder: "Example: Optimize this API and explain the bottleneck."
  });

  if (!prompt) return;

  const selected = vscode.window.activeTextEditor?.document.getText(
    vscode.window.activeTextEditor.selection
  ) || "";

  const context = await analyzer.buildContext(true, prompt);

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ZaynAI: ${area}`
      },
      () => requestAssistant(ai, analyzer, workspaceEditor, area, prompt, selected, true, context)
    );
    lastResponse = displayResult(result);

    const doc = await vscode.workspace.openTextDocument({
      content: lastResponse,
      language: "markdown"
    });

    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (error) {
    vscode.window.showErrorMessage(String(error));
  }
}

async function selectedAction(
  ai: AiService,
  analyzer: WorkspaceAnalyzer,
  workspaceEditor: WorkspaceEditor,
  area: string,
  instruction: string
) {
  try { await ai.auth.ensureActiveAccount(); } catch (err) { vscode.window.showErrorMessage(String(err)); return; }

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
  } catch (error) {
    vscode.window.showErrorMessage(String(error));
  }
}

export function deactivate() {}

async function requestAssistant(
  ai: AiService,
  analyzer: WorkspaceAnalyzer,
  workspaceEditor: WorkspaceEditor,
  area: string,
  prompt: string,
  selectedCode: string,
  includeWorkspace: boolean,
  existingContext?: string,
  history: ConversationTurn[] = []
): Promise<AssistantResult & { appliedChanges: string[]; applyErrors: string[]; changeStats: { added: number; removed: number } }> {
  const context = existingContext ?? await analyzer.buildContext(includeWorkspace, prompt);
  const raw = await ai.ask(area, prompt, context, selectedCode, history);
  const result = parseAssistantResult(raw);
  const autoApply = vscode.workspace
    .getConfiguration("zaynai")
    .get<boolean>("autoApplyGeneratedChanges", true);
  pendingChanges = result.changes;
  const application = autoApply && result.changes.length
    ? await workspaceEditor.apply(result.changes)
    : { applied: [], errors: [], added: 0, removed: 0 };
  return { ...result, appliedChanges: application.applied, applyErrors: application.errors, changeStats: { added: application.added, removed: application.removed } };
}

async function previewGeneratedChanges(changes: GeneratedChange[]) {
  if (!changes.length) {
    vscode.window.showInformationMessage("No generated file changes are waiting for review.");
    return;
  }

  let selected: GeneratedChange;
  if (changes.length === 1) {
    selected = changes[0];
  } else {
    const choice = await vscode.window.showQuickPick(
      changes.map(change => ({ label: change.path, description: change.description ?? "Generated update", change })),
      { title: "ZaynAI — Preview generated file change", placeHolder: "Choose a proposed file" }
    );
    if (!choice) return;
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
  await vscode.commands.executeCommand(
    "vscode.diff",
    original.uri,
    proposed.uri,
    `ZaynAI: ${selected.path} (proposed)`
  );
}

function languageFor(file: string): string {
  const extension = file.split(".").pop()?.toLowerCase();
  return ({ ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact", cs: "csharp", py: "python", json: "json", md: "markdown" } as Record<string, string>)[extension ?? ""] ?? "plaintext";
}

function displayResult(result: AssistantResult & { appliedChanges: string[]; applyErrors: string[] }): string {
  const status = result.appliedChanges.length
    ? `\n\nApplied files:\n${result.appliedChanges.map(file => `- ${file}`).join("\n")}`
    : "";
  const errors = result.applyErrors.length ? `\n\nApply errors:\n${result.applyErrors.join("\n")}` : "";
  return `${result.summary}${status}${errors}`;
}
