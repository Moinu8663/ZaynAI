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
const vscode = __importStar(require("vscode"));
const workspaceAnalyzer_1 = require("../../workspaceAnalyzer");
suite("WorkspaceAnalyzer Test Suite", () => {
    test("Extracts terms from prompt and filters out stop words", () => {
        const analyzer = new workspaceAnalyzer_1.WorkspaceAnalyzer();
        const prompt = "Please create a test file for the authService and database connection";
        const terms = analyzer.terms(prompt);
        assert.ok(terms.includes("authservice"));
        assert.ok(terms.includes("database"));
        assert.ok(terms.includes("connection"));
        assert.ok(!terms.includes("please"));
        assert.ok(!terms.includes("create"));
    });
    test("Calculates relevance score based on matching terms in path", () => {
        const analyzer = new workspaceAnalyzer_1.WorkspaceAnalyzer();
        const mockUri = vscode.Uri.file("/workspace/src/services/authService.ts");
        const mockFolder = {
            uri: vscode.Uri.file("/workspace"),
            name: "workspace",
            index: 0
        };
        const terms = ["authservice", "database"];
        const score = analyzer.relevance(mockUri, mockFolder, terms);
        assert.strictEqual(score, 10);
    });
});
//# sourceMappingURL=workspaceAnalyzer.test.js.map