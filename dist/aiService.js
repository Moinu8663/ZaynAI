"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
class AiService {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async ask(area, userPrompt, workspaceContext, selectedCode = "", history = []) {
        await this.auth.ensureActiveAccount();
        const token = await this.auth.getToken();
        let response;
        try {
            response = await fetch(`${this.auth.getBackendUrl()}/api/assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ area, prompt: userPrompt, workspaceContext, selectedCode, history })
            });
        }
        catch (err) {
            if (err?.message?.includes("fetch")) {
                throw new Error("Cannot reach ZaynAI server. Make sure the API is running on the configured backend URL.");
            }
            throw new Error(`Network error: ${err?.message ?? "Unknown connection failure."}`);
        }
        if (!response.ok) {
            await this.handleHttpError(response);
        }
        const result = await response.json();
        if (!result.text)
            throw new Error("The AI returned an empty response. Please try again.");
        return result.text;
    }
    async handleHttpError(response) {
        let body = "";
        try {
            body = await response.text();
        }
        catch { }
        let serverMsg = "";
        try {
            serverMsg = JSON.parse(body).message ?? "";
        }
        catch { }
        switch (response.status) {
            case 400: throw new Error(serverMsg || "Invalid request. Please check your prompt and try again.");
            case 401:
                await this.auth.signOut();
                throw new Error("Your session has expired. Please sign in again.");
            case 402: throw new Error("An active subscription is required. Please upgrade your plan to continue.");
            case 403: throw new Error("You do not have permission to perform this action.");
            case 429: throw new Error("Monthly request quota reached. Upgrade your plan or wait until next billing cycle.");
            case 500: throw new Error(serverMsg || "ZaynAI server error. The team has been notified — please try again shortly.");
            case 502:
            case 503: throw new Error("ZaynAI server is temporarily unavailable. Please try again in a moment.");
            case 504: throw new Error("The AI took too long to respond (gateway timeout). Try a shorter prompt or reduce workspace context.");
            default: throw new Error(serverMsg || `Unexpected error (HTTP ${response.status}). Please try again.`);
        }
    }
}
exports.AiService = AiService;
//# sourceMappingURL=aiService.js.map