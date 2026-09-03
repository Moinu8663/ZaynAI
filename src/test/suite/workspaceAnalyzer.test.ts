import * as assert from "assert";
import * as vscode from "vscode";
import { WorkspaceAnalyzer } from "../../workspaceAnalyzer";

suite("WorkspaceAnalyzer Test Suite", () => {
  test("Extracts terms from prompt and filters out stop words", () => {
    const analyzer = new WorkspaceAnalyzer() as any;
    const prompt = "Please create a test file for the authService and database connection";
    const terms = analyzer.terms(prompt);

    assert.ok(terms.includes("authservice"));
    assert.ok(terms.includes("database"));
    assert.ok(terms.includes("connection"));
    assert.ok(!terms.includes("please"));
    assert.ok(!terms.includes("create"));
  });

  test("Calculates relevance score based on matching terms in path", () => {
    const analyzer = new WorkspaceAnalyzer() as any;
    const mockUri = vscode.Uri.file("/workspace/src/services/authService.ts");
    const mockFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file("/workspace"),
      name: "workspace",
      index: 0
    };
    const terms = ["authservice", "database"];

    const score = analyzer.relevance(mockUri, mockFolder, terms);
    assert.strictEqual(score, 10);
  });
});
