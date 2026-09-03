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
const assert = __importStar(require("assert"));
const assistantResult_1 = require("../../assistantResult");
suite("AssistantResult Parser Test Suite", () => {
    test("Parses valid JSON wrapped in markdown code blocks", () => {
        const raw = `
Some conversational intro.
\`\`\`json
{
  "summary": "This is a summary of changes.",
  "findings": [
    {
      "category": "security",
      "severity": "high",
      "file": "src/auth.ts",
      "line": 12,
      "title": "Hardcoded secret",
      "description": "The token secret is hardcoded.",
      "recommendation": "Use environment variables."
    }
  ],
  "changes": [
    {
      "path": "src/auth.ts",
      "content": "const secret = process.env.SECRET;",
      "description": "Fix hardcoded secret"
    }
  ]
}
\`\`\`
Some conversational outro.
`;
        const result = (0, assistantResult_1.parseAssistantResult)(raw);
        assert.strictEqual(result.summary, "This is a summary of changes.");
        assert.strictEqual(result.findings.length, 1);
        assert.strictEqual(result.findings[0].category, "security");
        assert.strictEqual(result.findings[0].severity, "high");
        assert.strictEqual(result.findings[0].title, "Hardcoded secret");
        assert.strictEqual(result.changes.length, 1);
        assert.strictEqual(result.changes[0].path, "src/auth.ts");
        assert.strictEqual(result.changes[0].content, "const secret = process.env.SECRET;");
    });
    test("Parses raw JSON without markdown code blocks", () => {
        const raw = JSON.stringify({
            summary: "Direct JSON response",
            findings: [],
            changes: []
        });
        const result = (0, assistantResult_1.parseAssistantResult)(raw);
        assert.strictEqual(result.summary, "Direct JSON response");
        assert.strictEqual(result.findings.length, 0);
        assert.strictEqual(result.changes.length, 0);
    });
    test("Falls back gracefully on invalid JSON", () => {
        const raw = "This is not JSON at all. Just plain text explanation.";
        const result = (0, assistantResult_1.parseAssistantResult)(raw);
        assert.strictEqual(result.summary, raw);
        assert.strictEqual(result.findings.length, 0);
        assert.strictEqual(result.changes.length, 0);
    });
    test("Normalizes invalid categories and severities", () => {
        const raw = JSON.stringify({
            summary: "Normalization test",
            findings: [
                {
                    category: "invalid-category",
                    severity: "super-critical",
                    title: "Bad finding",
                    description: "Something is wrong"
                }
            ],
            changes: []
        });
        const result = (0, assistantResult_1.parseAssistantResult)(raw);
        assert.strictEqual(result.findings.length, 1);
        assert.strictEqual(result.findings[0].category, "code-review");
        assert.strictEqual(result.findings[0].severity, "medium");
    });
    test("Filters out invalid findings and changes", () => {
        const raw = JSON.stringify({
            summary: "Filtering test",
            findings: [
                {
                    category: "security"
                }
            ],
            changes: [
                {
                    path: "src/index.ts"
                }
            ]
        });
        const result = (0, assistantResult_1.parseAssistantResult)(raw);
        assert.strictEqual(result.findings.length, 0);
        assert.strictEqual(result.changes.length, 0);
    });
});
//# sourceMappingURL=assistantResult.test.js.map