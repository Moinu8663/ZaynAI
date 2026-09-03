"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBVIEW_STYLES = void 0;
exports.WEBVIEW_STYLES = `
*{box-sizing:border-box}
html,body{height:100%;margin:0;overflow:hidden}
body{padding:10px;color:var(--vscode-foreground);font-family:var(--vscode-font-family);font-size:13px;background:var(--vscode-sideBar-background)}

/* ── Auth ── */
#authScreen{display:flex;flex-direction:column;gap:9px}
.auth-header{display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;background:var(--vscode-editor-background);border:1px solid var(--vscode-focusBorder)}
.auth-logo{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.auth-logo svg{width:16px;height:16px}
.auth-brand{font-weight:700;font-size:13px}
.auth-brand small{display:block;font-weight:400;font-size:11px;opacity:.7}
.tab-row{display:grid;grid-template-columns:1fr 1fr;background:var(--vscode-editor-background);border:1px solid var(--vscode-widget-border);border-radius:6px;padding:3px}
.tab-btn{border:none;background:transparent;color:var(--vscode-foreground);opacity:.6;font:inherit;font-size:12px;font-weight:600;padding:6px;border-radius:4px;cursor:pointer;transition:all .15s}
.tab-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);opacity:1}
.auth-form{display:flex;flex-direction:column;gap:7px}
.auth-form label{font-size:11px;font-weight:600;opacity:.8;margin-bottom:2px;display:block}
.auth-form input,.auth-form select{width:100%;padding:7px 9px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;font:inherit;font-size:12px;outline:none}
.auth-form input:focus,.auth-form select:focus{border-color:var(--vscode-focusBorder)}
.btn-primary{width:100%;padding:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:6px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;margin-top:2px}
.btn-primary:disabled{opacity:.55;cursor:not-allowed}
.auth-error{padding:7px 9px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:5px;color:#f87171;font-size:11px;display:none}
.auth-error.show{display:block}
.plan-hint{font-size:10px;opacity:.6;text-align:center;margin-top:2px}

/* ── Chat screen ── */
#chatScreen{display:none;flex-direction:column;height:100%}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px}
.user-info{display:flex;align-items:center;gap:7px;min-width:0}
.avatar{width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.user-meta{min-width:0}
.user-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-plan{font-size:10px;opacity:.65}
.topbar-actions{display:flex;gap:4px;flex-shrink:0}
.icon-btn{width:26px;height:26px;padding:0;border:1px solid var(--vscode-widget-border);background:transparent;color:var(--vscode-foreground);border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px}
.icon-btn:hover{background:var(--vscode-list-hoverBackground)}
.caps-bar{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
.cap-badge{padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.cap-badge.on{background:rgba(99,102,241,.18);color:#818cf8;border:1px solid rgba(99,102,241,.3)}
.cap-badge.off{opacity:.4}

/* ── Messages ── */
#result{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px;background:var(--vscode-textCodeBlock-background);border-radius:7px;margin-bottom:6px;min-height:100px}
.chat-msg{margin-bottom:7px;padding:7px 9px;border-radius:6px;line-height:1.5;font-size:12px;position:relative}
.chat-msg.user{background:var(--vscode-button-secondaryBackground);margin-left:12px}
.chat-msg.assistant{background:var(--vscode-editor-background);margin-right:12px}
.chat-msg.error-msg{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);margin-right:12px}
.chat-label{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:700;opacity:.6;text-transform:uppercase;margin-bottom:4px}
.copy-btn{font-size:10px;opacity:.5;cursor:pointer;background:none;border:none;color:inherit;padding:0;font-weight:600}
.copy-btn:hover{opacity:1}
.msg-body{white-space:pre-wrap;word-break:break-word}
.msg-body code{background:var(--vscode-textCodeBlock-background);padding:1px 4px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px}
.msg-body pre{background:var(--vscode-textCodeBlock-background);padding:8px;border-radius:5px;overflow-x:auto;margin:5px 0}
.msg-body pre code{background:none;padding:0}
.change-count{display:flex;gap:7px;margin-top:5px;font-size:10px;font-weight:700}
.added{color:var(--vscode-testing-iconPassed,#4ec9b0)}
.removed{color:var(--vscode-testing-iconFailed,#f14c4c)}
.error-actions{margin-top:6px}
.retry-btn{font-size:11px;padding:3px 10px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:4px;cursor:pointer;font:inherit;font-weight:600}
.retry-btn:hover{background:rgba(239,68,68,.25)}

/* ── Typing indicator ── */
.typing-dots{display:inline-flex;gap:3px;align-items:center;padding:4px 0}
.typing-dots span{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.4;animation:dot-bounce .9s infinite}
.typing-dots span:nth-child(2){animation-delay:.15s}
.typing-dots span:nth-child(3){animation-delay:.3s}
@keyframes dot-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}

/* ── Composer ── */
.composer{padding:7px;border:1px solid var(--vscode-widget-border);border-radius:8px;background:var(--vscode-editor-background)}
.composer-top{display:flex;gap:5px;margin-bottom:5px}
.composer-top select{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;padding:5px 7px;font:inherit;font-size:11px}
.textarea-wrap{position:relative}
.composer textarea{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;padding:6px 8px;font:inherit;font-size:12px;margin-bottom:5px;min-height:68px;resize:vertical;display:block}
.composer textarea:focus{outline:none;border-color:var(--vscode-focusBorder)}
.char-count{position:absolute;bottom:9px;right:6px;font-size:10px;opacity:.4;pointer-events:none}
.char-count.warn{opacity:.8;color:#f59e0b}
.composer-footer{display:flex;gap:5px;align-items:center}
.attach-sel{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;padding:5px 7px;font:inherit;font-size:11px}
.send-btn{padding:6px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:5px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.send-btn:disabled{opacity:.5;cursor:not-allowed}
.clear-btn{width:26px;height:26px;padding:0;border:1px solid var(--vscode-widget-border);background:transparent;color:var(--vscode-foreground);border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.clear-btn:hover{background:var(--vscode-list-hoverBackground)}

/* ── Dashboard ── */
.dashboard{margin-top:6px;border:1px solid var(--vscode-widget-border);border-radius:7px;overflow:hidden}
.dashboard summary{padding:6px 10px;cursor:pointer;font-weight:700;font-size:11px;user-select:none}
.dash-body{padding:0 8px 8px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px}
.metric{padding:5px 2px;text-align:center;background:var(--vscode-textCodeBlock-background);border-radius:5px;font-size:10px}
.metric strong{display:block;font-size:15px}
.finding{margin-top:5px;padding:6px 8px;border-left:3px solid var(--vscode-charts-yellow);background:var(--vscode-textCodeBlock-background);border-radius:0 4px 4px 0;font-size:11px}
.finding.critical,.finding.high{border-left-color:#f14c4c}
.finding.medium{border-left-color:#f59e0b}
.finding.security{border-left-color:#a78bfa}
.finding-title{font-weight:700;margin-bottom:2px}
.finding-loc{opacity:.6;font-size:10px;margin-bottom:3px}
.finding-rec{opacity:.8;font-size:10px;margin-top:3px;font-style:italic}
.pending{margin-top:6px;padding:6px;border-radius:5px;background:var(--vscode-textCodeBlock-background);font-size:11px}
.hidden{display:none}
.spinner{display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-2px;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;
//# sourceMappingURL=webviewStyles.js.map