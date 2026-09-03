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
const workspaceEditor_1 = require("../../workspaceEditor");
suite("WorkspaceEditor Test Suite", () => {
    test("Calculates line changes correctly for additions", () => {
        const editor = new workspaceEditor_1.WorkspaceEditor();
        const before = "line1\nline2";
        const after = "line1\nline2\nline3\nline4";
        const stats = editor.lineChanges(before, after);
        assert.strictEqual(stats.added, 2);
        assert.strictEqual(stats.removed, 0);
    });
    test("Calculates line changes correctly for removals", () => {
        const editor = new workspaceEditor_1.WorkspaceEditor();
        const before = "line1\nline2\nline3";
        const after = "line1";
        const stats = editor.lineChanges(before, after);
        assert.strictEqual(stats.added, 0);
        assert.strictEqual(stats.removed, 2);
    });
    test("Calculates line changes correctly for modifications", () => {
        const editor = new workspaceEditor_1.WorkspaceEditor();
        const before = "line1\nline2\nline3";
        const after = "line1\nline2-modified\nline3";
        const stats = editor.lineChanges(before, after);
        assert.strictEqual(stats.added, 1);
        assert.strictEqual(stats.removed, 1);
    });
    test("Handles empty inputs gracefully", () => {
        const editor = new workspaceEditor_1.WorkspaceEditor();
        const stats = editor.lineChanges("", "");
        assert.strictEqual(stats.added, 0);
        assert.strictEqual(stats.removed, 0);
    });
});
//# sourceMappingURL=workspaceEditor.test.js.map