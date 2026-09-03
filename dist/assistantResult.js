"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAssistantResult = parseAssistantResult;
const categories = new Set(["error", "performance", "security", "code-review"]);
const severities = new Set(["critical", "high", "medium", "low"]);
function parseAssistantResult(raw) {
    // Try fenced JSON block first, then bare JSON object
    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
    const bareJson = raw.match(/(\{[\s\S]*\})/)?.[1];
    const candidate = fenced ?? bareJson ?? raw.trim();
    try {
        const value = JSON.parse(candidate);
        if (!value || typeof value !== "object")
            throw new Error();
        const findings = Array.isArray(value.findings)
            ? value.findings.filter(isFinding).map(normalizeFinding)
            : [];
        const changes = Array.isArray(value.changes)
            ? value.changes.filter(isChange).map((c) => ({
                path: c.path.replace(/\\/g, "/"),
                content: c.content,
                description: c.description
            }))
            : [];
        return {
            summary: typeof value.summary === "string" && value.summary.trim()
                ? value.summary
                : raw,
            findings,
            changes,
            raw
        };
    }
    catch {
        return { summary: raw, findings: [], changes: [], raw };
    }
}
function isFinding(v) {
    return v && typeof v.title === "string" && typeof v.description === "string";
}
function normalizeFinding(f) {
    return {
        ...f,
        category: categories.has(f.category) ? f.category : "code-review",
        severity: severities.has(f.severity) ? f.severity : "medium",
        recommendation: typeof f.recommendation === "string" ? f.recommendation : "Review and address this issue."
    };
}
function isChange(v) {
    return v && typeof v.path === "string" && typeof v.content === "string";
}
//# sourceMappingURL=assistantResult.js.map