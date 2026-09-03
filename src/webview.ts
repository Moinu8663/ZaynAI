import * as vscode from "vscode";
import * as crypto from "crypto";
import { AssistantResult } from "./assistantResult";
import { AuthService } from "./authService";
import { WEBVIEW_STYLES } from "./webviewStyles";
import { WEBVIEW_BODY } from "./webviewBody";
import { WEBVIEW_SCRIPT } from "./webviewScript";

export type ConversationTurn = { role: "user" | "assistant"; content: string };

type Request = {
  area: string;
  prompt: string;
  includeWorkspace: boolean;
  selectedCode: string;
  history: ConversationTurn[];
};

type ViewResult = AssistantResult & {
  appliedChanges: string[];
  applyErrors: string[];
  changeStats: { added: number; removed: number };
};

export class DevAssistantView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private conversationHistory: ConversationTurn[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly auth: AuthService,
    private readonly handler: (request: Request) => Promise<ViewResult>
  ) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    this.refreshAccount();

    view.webview.onDidReceiveMessage(async message => {
      switch (message.type) {

        case "signIn": {
          try {
            const user = await this.auth.signInDirect(message.email, message.password);
            const caps = await this.auth.getCapabilities();
            view.webview.postMessage({ type: "authSuccess", user, caps });
          } catch (err) {
            view.webview.postMessage({ type: "authError", text: String(err).replace("Error: ", "") });
          }
          break;
        }

        case "signUp": {
          try {
            const user = await this.auth.signUpDirect(message.name, message.email, message.password, message.planId);
            const caps = await this.auth.getCapabilities();
            view.webview.postMessage({ type: "authSuccess", user, caps });
          } catch (err) {
            view.webview.postMessage({ type: "authError", text: String(err).replace("Error: ", "") });
          }
          break;
        }

        case "loadPlans": {
          try {
            const plans = await this.auth.getPlans();
            view.webview.postMessage({ type: "plans", plans });
          } catch {
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
          const userPrompt: string = message.request.prompt;
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
          } catch (error) {
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
    if (!webview) return;
    const user = await this.auth.getCurrentUser().catch(() => undefined);
    const caps = user ? await this.auth.getCapabilities().catch(() => undefined) : undefined;
    webview.postMessage({ type: "account", user: user ?? null, caps: caps ?? null });
  }

  private displayResult(result: ViewResult): string {
    const applied = result.appliedChanges.length
      ? `\n\nApplied files:\n${result.appliedChanges.map(f => `- ${f}`).join("\n")}` : "";
    const errors = result.applyErrors.length
      ? `\n\nApply errors:\n${result.applyErrors.join("\n")}` : "";
    return `${result.summary}${applied}${errors}`;
  }

  private html(): string {
    const nonce = crypto.randomBytes(16).toString("base64");
    return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${WEBVIEW_STYLES}</style>
</head>
<body>
${WEBVIEW_BODY}
<script nonce="${nonce}">${WEBVIEW_SCRIPT}</script>
</body>
</html>`;
  }
}
