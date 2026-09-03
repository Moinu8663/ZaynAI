import * as assert from "assert";
import { parseAssistantResult } from "../../assistantResult";

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

    const result = parseAssistantResult(raw);
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

    const result = parseAssistantResult(raw);
    assert.strictEqual(result.summary, "Direct JSON response");
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.changes.length, 0);
  });

  test("Falls back gracefully on invalid JSON", () => {
    const raw = "This is not JSON at all. Just plain text explanation.";
    const result = parseAssistantResult(raw);
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

    const result = parseAssistantResult(raw);
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

    const result = parseAssistantResult(raw);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.changes.length, 0);
  });
});
