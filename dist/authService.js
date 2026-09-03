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
exports.AuthService = void 0;
const vscode = __importStar(require("vscode"));
const tokenKey = "zaynai.accountToken";
const userKey = "zaynai.accountUser";
class AuthService {
    context;
    constructor(context) {
        this.context = context;
    }
    getBackendUrl() {
        return vscode.workspace
            .getConfiguration("zaynai")
            .get("backendUrl", "http://localhost:5206")
            .replace(/\/$/, "");
    }
    getPortalUrl() {
        return vscode.workspace
            .getConfiguration("zaynai")
            .get("portalUrl", "http://127.0.0.1:4200");
    }
    async getToken() {
        return this.context.secrets.get(tokenKey);
    }
    getCachedUser() {
        const saved = this.context.globalState.get(userKey);
        if (!saved)
            return undefined;
        try {
            return JSON.parse(saved);
        }
        catch {
            return undefined;
        }
    }
    async getCurrentUser() {
        const token = await this.getToken();
        if (!token)
            return undefined;
        try {
            const res = await fetch(`${this.getBackendUrl()}/api/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                await this.signOut();
                return undefined;
            }
            const user = await res.json();
            await this.saveUser(user);
            return user;
        }
        catch {
            return undefined;
        }
    }
    async ensureActiveAccount() {
        const user = await this.getCurrentUser();
        if (!user) {
            throw new Error("Sign in to use ZaynAI.");
        }
        if (user.subscription.status !== "Active") {
            const choice = await vscode.window.showWarningMessage("Your subscription is not active.", "Manage subscription");
            if (choice)
                await this.openSubscriptionPortal();
            throw new Error("An active subscription is required to use ZaynAI.");
        }
        return user;
    }
    // Called directly from webview with credentials already collected in-panel
    async signInDirect(email, password) {
        return this.authenticate("/api/auth/signin", { email, password });
    }
    async signUpDirect(name, email, password, planId) {
        return this.authenticate("/api/auth/signup", { name, email, password, planId });
    }
    async signInWithPrompts() {
        const email = await vscode.window.showInputBox({
            title: "ZaynAI — Sign in", prompt: "Email address", ignoreFocusOut: true
        });
        if (!email)
            return undefined;
        const password = await vscode.window.showInputBox({
            title: "ZaynAI — Sign in", prompt: "Password", password: true, ignoreFocusOut: true
        });
        if (!password)
            return undefined;
        return this.authenticate("/api/auth/signin", { email, password });
    }
    async signUpWithPrompts() {
        const name = await vscode.window.showInputBox({
            title: "ZaynAI — Create account", prompt: "Your name", ignoreFocusOut: true
        });
        if (!name)
            return undefined;
        const email = await vscode.window.showInputBox({
            title: "ZaynAI — Create account", prompt: "Email address", ignoreFocusOut: true
        });
        if (!email)
            return undefined;
        const password = await vscode.window.showInputBox({
            title: "ZaynAI — Create account",
            prompt: "Password (min 8 characters)", password: true, ignoreFocusOut: true
        });
        if (!password)
            return undefined;
        const plans = await this.getPlans();
        const selected = await vscode.window.showQuickPick(plans.map(p => ({
            label: p.name,
            description: `$${p.monthlyPrice}/mo`,
            detail: `${p.monthlyAssistantRequests} requests · ${p.workspaceScans} scans`,
            plan: p
        })), { title: "ZaynAI — Choose a subscription plan" });
        if (!selected)
            return undefined;
        return this.authenticate("/api/auth/signup", { name, email, password, planId: selected.plan.id });
    }
    async signOut() {
        await this.context.secrets.delete(tokenKey);
        await this.context.globalState.update(userKey, undefined);
    }
    async openSubscriptionPortal() {
        await vscode.env.openExternal(vscode.Uri.parse(this.getPortalUrl()));
    }
    async getPlans() {
        const res = await fetch(`${this.getBackendUrl()}/api/plans`);
        if (!res.ok)
            throw new Error(`Could not load plans: ${res.status}`);
        return res.json();
    }
    async getCapabilities() {
        const token = await this.getToken();
        if (!token)
            return undefined;
        try {
            const res = await fetch(`${this.getBackendUrl()}/api/capabilities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok)
                return undefined;
            return res.json();
        }
        catch {
            return undefined;
        }
    }
    async authenticate(path, body) {
        const res = await fetch(`${this.getBackendUrl()}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            let msg = `Authentication failed (${res.status})`;
            try {
                const j = await res.json();
                msg = j.message ?? msg;
            }
            catch { }
            throw new Error(msg);
        }
        const auth = await res.json();
        await this.context.secrets.store(tokenKey, auth.token);
        await this.saveUser(auth.user);
        return auth.user;
    }
    async saveUser(user) {
        await this.context.globalState.update(userKey, JSON.stringify(user));
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map