import * as vscode from "vscode";

export type SubscriptionPlan = {
  id: string;
  name: string;
  monthlyPrice: number;
  monthlyAssistantRequests: number;
  workspaceScans: number;
  features: string[];
};

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  subscription: {
    planId: string;
    planName: string;
    monthlyPrice: number;
    status: string;
    renewsAt?: string | null;
  };
};

export type PlanCapability = {
  planId: string;
  model: string;
  maxOutputTokens: number;
  allowCodeChanges: boolean;
  allowWorkspaceScan: boolean;
};

type AuthResponse = { token: string; user: AccountUser };

const tokenKey = "zaynai.accountToken";
const userKey  = "zaynai.accountUser";

export class AuthService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getBackendUrl(): string {
    return vscode.workspace
      .getConfiguration("zaynai")
      .get<string>("backendUrl", "http://localhost:5206")
      .replace(/\/$/, "");
  }

  getPortalUrl(): string {
    return vscode.workspace
      .getConfiguration("zaynai")
      .get<string>("portalUrl", "http://127.0.0.1:4200");
  }

  async getToken(): Promise<string | undefined> {
    return this.context.secrets.get(tokenKey);
  }

  getCachedUser(): AccountUser | undefined {
    const saved = this.context.globalState.get<string>(userKey);
    if (!saved) return undefined;
    try { return JSON.parse(saved) as AccountUser; } catch { return undefined; }
  }

  async getCurrentUser(): Promise<AccountUser | undefined> {
    const token = await this.getToken();
    if (!token) return undefined;
    try {
      const res = await fetch(`${this.getBackendUrl()}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { await this.signOut(); return undefined; }
      const user = await res.json() as AccountUser;
      await this.saveUser(user);
      return user;
    } catch {
      return undefined;
    }
  }

  async ensureActiveAccount(): Promise<AccountUser> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error("Sign in to use ZaynAI.");
    }
    if (user.subscription.status !== "Active") {
      const choice = await vscode.window.showWarningMessage(
        "Your subscription is not active.",
        "Manage subscription"
      );
      if (choice) await this.openSubscriptionPortal();
      throw new Error("An active subscription is required to use ZaynAI.");
    }
    return user;
  }

  // Called directly from webview with credentials already collected in-panel
  async signInDirect(email: string, password: string): Promise<AccountUser> {
    return this.authenticate("/api/auth/signin", { email, password });
  }

  async signUpDirect(name: string, email: string, password: string, planId: string): Promise<AccountUser> {
    return this.authenticate("/api/auth/signup", { name, email, password, planId });
  }

  async signInWithPrompts(): Promise<AccountUser | undefined> {
    const email = await vscode.window.showInputBox({
      title: "ZaynAI — Sign in", prompt: "Email address", ignoreFocusOut: true
    });
    if (!email) return undefined;
    const password = await vscode.window.showInputBox({
      title: "ZaynAI — Sign in", prompt: "Password", password: true, ignoreFocusOut: true
    });
    if (!password) return undefined;
    return this.authenticate("/api/auth/signin", { email, password });
  }

  async signUpWithPrompts(): Promise<AccountUser | undefined> {
    const name = await vscode.window.showInputBox({
      title: "ZaynAI — Create account", prompt: "Your name", ignoreFocusOut: true
    });
    if (!name) return undefined;
    const email = await vscode.window.showInputBox({
      title: "ZaynAI — Create account", prompt: "Email address", ignoreFocusOut: true
    });
    if (!email) return undefined;
    const password = await vscode.window.showInputBox({
      title: "ZaynAI — Create account",
      prompt: "Password (min 8 characters)", password: true, ignoreFocusOut: true
    });
    if (!password) return undefined;
    const plans = await this.getPlans();
    const selected = await vscode.window.showQuickPick(
      plans.map(p => ({
        label: p.name,
        description: `$${p.monthlyPrice}/mo`,
        detail: `${p.monthlyAssistantRequests} requests · ${p.workspaceScans} scans`,
        plan: p
      })),
      { title: "ZaynAI — Choose a subscription plan" }
    );
    if (!selected) return undefined;
    return this.authenticate("/api/auth/signup", { name, email, password, planId: selected.plan.id });
  }

  async signOut(): Promise<void> {
    await this.context.secrets.delete(tokenKey);
    await this.context.globalState.update(userKey, undefined);
  }

  async openSubscriptionPortal(): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(this.getPortalUrl()));
  }

  async getPlans(): Promise<SubscriptionPlan[]> {
    const res = await fetch(`${this.getBackendUrl()}/api/plans`);
    if (!res.ok) throw new Error(`Could not load plans: ${res.status}`);
    return res.json() as Promise<SubscriptionPlan[]>;
  }

  async getCapabilities(): Promise<PlanCapability | undefined> {
    const token = await this.getToken();
    if (!token) return undefined;
    try {
      const res = await fetch(`${this.getBackendUrl()}/api/capabilities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return undefined;
      return res.json() as Promise<PlanCapability>;
    } catch { return undefined; }
  }

  private async authenticate(path: string, body: unknown): Promise<AccountUser> {
    const res = await fetch(`${this.getBackendUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = `Authentication failed (${res.status})`;
      try { const j = await res.json() as { message?: string }; msg = j.message ?? msg; } catch {}
      throw new Error(msg);
    }
    const auth = await res.json() as AuthResponse;
    await this.context.secrets.store(tokenKey, auth.token);
    await this.saveUser(auth.user);
    return auth.user;
  }

  private async saveUser(user: AccountUser): Promise<void> {
    await this.context.globalState.update(userKey, JSON.stringify(user));
  }
}
