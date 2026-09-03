export const WEBVIEW_BODY = `
<!-- AUTH SCREEN -->
<div id="authScreen">
  <div class="auth-header">
    <div class="auth-logo">
      <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h4l2-5 2 10 2-5h2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="auth-brand">ZaynAI<small>Your expert AI coding partner</small></div>
  </div>
  <div class="tab-row">
    <button class="tab-btn active" id="tabSignIn">Sign in</button>
    <button class="tab-btn" id="tabSignUp">Create account</button>
  </div>
  <div class="auth-form" id="formSignIn">
    <div><label>Email</label><input id="siEmail" type="email" placeholder="you@company.com" autocomplete="email"></div>
    <div><label>Password</label><input id="siPassword" type="password" placeholder="Password" autocomplete="current-password"></div>
    <div id="siError" class="auth-error"></div>
    <button class="btn-primary" id="btnSignIn">Sign in</button>
  </div>
  <div class="auth-form hidden" id="formSignUp">
    <div><label>Full name</label><input id="suName" type="text" placeholder="Alex Developer" autocomplete="name"></div>
    <div><label>Email</label><input id="suEmail" type="email" placeholder="you@company.com" autocomplete="email"></div>
    <div><label>Password</label><input id="suPassword" type="password" placeholder="Min. 8 characters" autocomplete="new-password"></div>
    <div><label>Plan</label><select id="suPlan"><option value="">Loading plans...</option></select></div>
    <div id="suError" class="auth-error"></div>
    <button class="btn-primary" id="btnSignUp">Create account</button>
    <p class="plan-hint">No API key needed — managed by your ZaynAI plan.</p>
  </div>
</div>

<!-- CHAT SCREEN -->
<div id="chatScreen">
  <div class="topbar">
    <div class="user-info">
      <div class="avatar" id="avatarLetter">?</div>
      <div class="user-meta">
        <div class="user-name" id="userName">—</div>
        <div class="user-plan" id="userPlan">—</div>
      </div>
    </div>
    <div class="topbar-actions">
      <button class="icon-btn" id="btnSubscription" title="Manage subscription">&#9881;</button>
      <button class="icon-btn" id="btnSignOut" title="Sign out">&#8617;</button>
    </div>
  </div>

  <div class="caps-bar" id="capsBar"></div>

  <div id="result"><span style="opacity:.5;font-size:12px">Ask ZaynAI anything about your codebase...</span></div>

  <div class="composer">
    <div class="composer-top">
      <select id="area">
        <option>Architecture</option><option>Coding</option><option>Debugging</option>
        <option>Migration</option><option>Testing</option><option>Database</option>
        <option>DevOps</option><option>Security</option><option>Performance</option>
        <option>Documentation</option><option>UI / UX</option><option>Code Review</option>
        <option>Automation</option><option>General</option>
      </select>
      <select id="attachment" class="attach-sel">
        <option value="workspace">Workspace context</option>
        <option value="active">Active file only</option>
      </select>
    </div>
    <div class="textarea-wrap">
      <textarea id="prompt" placeholder="Ask ZaynAI... (Ctrl+Enter to send)"></textarea>
      <span class="char-count" id="charCount">0</span>
    </div>
    <div class="composer-footer">
      <button class="clear-btn" id="btnClear" title="Clear conversation">&#128465;</button>
      <button class="send-btn" id="btnAsk" disabled>Send</button>
    </div>
  </div>

  <details class="dashboard">
    <summary>Quality dashboard</summary>
    <div class="dash-body">
      <div class="metrics">
        <div class="metric"><strong id="cntErrors">0</strong>Errors</div>
        <div class="metric"><strong id="cntPerf">0</strong>Perf</div>
        <div class="metric"><strong id="cntSec">0</strong>Security</div>
        <div class="metric"><strong id="cntReview">0</strong>Review</div>
      </div>
      <div id="findings" style="font-size:11px">Run an analysis to populate findings.</div>
      <div id="pending" class="pending">No pending file changes.</div>
    </div>
  </details>
</div>
`;
