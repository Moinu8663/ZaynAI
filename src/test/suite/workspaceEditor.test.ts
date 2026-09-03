import * as assert from "assert";
import { WorkspaceEditor } from "../../workspaceEditor";

suite("WorkspaceEditor Test Suite", () => {
  test("Calculates line changes correctly for additions", () => {
    const editor = new WorkspaceEditor() as any;
    const before = "line1\nline2";
    const after = "line1\nline2\nline3\nline4";
    
    const stats = editor.lineChanges(before, after);
    assert.strictEqual(stats.added, 2);
    assert.strictEqual(stats.removed, 0);
  });

  test("Calculates line changes correctly for removals", () => {
    const editor = new WorkspaceEditor() as any;
    const before = "line1\nline2\nline3";
    const after = "line1";
    
    const stats = editor.lineChanges(before, after);
    assert.strictEqual(stats.added, 0);
    assert.strictEqual(stats.removed, 2);
  });

  test("Calculates line changes correctly for modifications", () => {
    const editor = new WorkspaceEditor() as any;
    const before = "line1\nline2\nline3";
    const after = "line1\nline2-modified\nline3";
    
    const stats = editor.lineChanges(before, after);
    assert.strictEqual(stats.added, 1);
    assert.strictEqual(stats.removed, 1);
  });

  test("Handles empty inputs gracefully", () => {
    const editor = new WorkspaceEditor() as any;
    const stats = editor.lineChanges("", "");
    assert.strictEqual(stats.added, 0);
    assert.strictEqual(stats.removed, 0);
  });
});
