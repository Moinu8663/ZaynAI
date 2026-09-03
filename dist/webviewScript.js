"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBVIEW_SCRIPT = void 0;
exports.WEBVIEW_SCRIPT = `
const vscode = acquireVsCodeApi();
const saved = vscode.getState() || { history: [] };
const history = Array.isArray(saved.history) ? saved.history : [];
let signedIn = false;
let lastPrompt = '';
let lastArea = 'General';
let lastAttach = 'workspace';

// ── Auth tabs ─────────────────────────────────────────────────
document.getElementById('tabSignIn').addEventListener('click', () => switchTab('signin'));
document.getElementById('tabSignUp').addEventListener('click', () => {
  switchTab('signup');
  vscode.postMessage({ type: 'loadPlans' });
});

function switchTab(tab) {
  const si = tab === 'signin';
  document.getElementById('tabSignIn').classList.toggle('active', si);
  document.getElementById('tabSignUp').classList.toggle('active', !si);
  document.getElementById('formSignIn').classList.toggle('hidden', !si);
  document.getElementById('formSignUp').classList.toggle('hidden', si);
}

// ── Sign in ───────────────────────────────────────────────────
document.getElementById('btnSignIn').addEventListener('click', () => {
  const email = document.getElementById('siEmail').value.trim();
  const password = document.getElementById('siPassword').value;
  if (!email) { showAuthError('siError', 'Email is required.'); return; }
  if (!password) { showAuthError('siError', 'Password is required.'); return; }
  if (!isValidEmail(email)) { showAuthError('siError', 'Please enter a valid email address.'); return; }
  setAuthLoading('btnSignIn', true);
  vscode.postMessage({ type: 'signIn', email, password });
});

document.getElementById('siPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnSignIn').click();
});

// ── Sign up ───────────────────────────────────────────────────
document.getElementById('btnSignUp').addEventListener('click', () => {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const password = document.getElementById('suPassword').value;
  const planId = document.getElementById('suPlan').value;
  if (!name) { showAuthError('suError', 'Full name is required.'); return; }
  if (!email || !isValidEmail(email)) { showAuthError('suError', 'A valid email address is required.'); return; }
  if (!password || password.length < 8) { showAuthError('suError', 'Password must be at least 8 characters.'); return; }
  if (!planId) { showAuthError('suError', 'Please select a plan.'); return; }
  setAuthLoading('btnSignUp', true);
  vscode.postMessage({ type: 'signUp', name, email, password, planId });
});

// ── Char counter ──────────────────────────────────────────────
const promptEl = document.getElementById('prompt');
const charCountEl = document.getElementById('charCount');
promptEl.addEventListener('input', () => {
  const len = promptEl.value.length;
  charCountEl.textContent = len > 0 ? len : '';
  charCountEl.classList.toggle('warn', len > 1800);
});

// ── Send ──────────────────────────────────────────────────────
document.getElementById('btnAsk').addEventListener('click', sendMessage);
promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMessage();
});

function sendMessage() {
  const prompt = promptEl.value.trim();
  if (!prompt || !signedIn) return;
  lastPrompt = prompt;
  lastArea = document.getElementById('area').value;
  lastAttach = document.getElementById('attachment').value;
  addMessage('user', prompt);
  setSending(true);
  promptEl.value = '';
  charCountEl.textContent = '';
  vscode.postMessage({
    type: 'ask',
    request: { area: lastArea, prompt, includeWorkspace: lastAttach === 'workspace', selectedCode: '' }
  });
}

// ── Clear ─────────────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', () => {
  history.length = 0;
  vscode.setState({ history: [] });
  vscode.postMessage({ type: 'clearHistory' });
  renderHistory();
});

// ── Topbar ────────────────────────────────────────────────────
document.getElementById('btnSignOut').addEventListener('click', () => vscode.postMessage({ type: 'signOut' }));
document.getElementById('btnSubscription').addEventListener('click', () => vscode.postMessage({ type: 'manageSubscription' }));

// ── Message handler ───────────────────────────────────────────
window.addEventListener('message', e => {
  const m = e.data;

  if (m.type === 'account') {
    m.user ? showChat(m.user, m.caps) : showAuth();
  }

  if (m.type === 'authSuccess') {
    setAuthLoading('btnSignIn', false);
    setAuthLoading('btnSignUp', false);
    showChat(m.user, m.caps);
  }

  if (m.type === 'authError') {
    setAuthLoading('btnSignIn', false);
    setAuthLoading('btnSignUp', false);
    const errId = document.getElementById('formSignIn').classList.contains('hidden') ? 'suError' : 'siError';
    showAuthError(errId, m.text);
  }

  if (m.type === 'plans') {
    const sel = document.getElementById('suPlan');
    if (!m.plans.length) {
      sel.innerHTML = '<option value="">Could not load plans — check server connection</option>';
      return;
    }
    sel.innerHTML = m.plans.map(p =>
      '<option value="' + p.id + '">' + p.name + ' — $' + p.monthlyPrice + '/mo</option>'
    ).join('');
  }

  if (m.type === 'result') {
    setSending(false);
    addMessage('assistant', m.text, m.changeStats);
    renderDashboard(m.findings || []);
    const pending = document.getElementById('pending');
    if (m.appliedChanges && m.appliedChanges.length) {
      pending.textContent = 'Applied ' + m.appliedChanges.length + ' file(s). Use Preview to review changes.';
    } else if (m.proposedChanges > 0) {
      pending.innerHTML = m.proposedChanges + ' proposed change(s). <a href="#" id="previewLink" style="color:#818cf8">Preview diff</a>';
      document.getElementById('previewLink').addEventListener('click', e => {
        e.preventDefault();
        vscode.postMessage({ type: 'previewChanges' });
      });
    } else {
      pending.textContent = 'No pending file changes.';
    }
    if (m.applyErrors && m.applyErrors.length) {
      addMessage('error', 'Apply errors:\n' + m.applyErrors.join('\n'));
    }
  }

  if (m.type === 'error') {
    setSending(false);
    addErrorMessage(m.text);
  }
});

// ── Helpers ───────────────────────────────────────────────────
function showAuth() {
  signedIn = false;
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('chatScreen').style.display = 'none';
  document.getElementById('btnAsk').disabled = true;
}

function showChat(user, caps) {
  signedIn = true;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('chatScreen').style.display = 'flex';
  document.getElementById('btnAsk').disabled = false;
  document.getElementById('avatarLetter').textContent = (user.name || '?').charAt(0).toUpperCase();
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userPlan').textContent = user.subscription.planName + ' · ' + user.subscription.status;
  renderCaps(caps);
  renderHistory();
}

function renderCaps(caps) {
  const bar = document.getElementById('capsBar');
  if (!caps) { bar.innerHTML = ''; return; }
  bar.innerHTML =
    '<span class="cap-badge on">&#129302; ' + caps.model + '</span>' +
    '<span class="cap-badge ' + (caps.allowCodeChanges ? 'on' : 'off') + '">Code edits</span>' +
    '<span class="cap-badge ' + (caps.allowWorkspaceScan ? 'on' : 'off') + '">Workspace</span>';
  const wsOpt = document.querySelector('#attachment option[value="workspace"]');
  if (wsOpt) {
    wsOpt.disabled = !caps.allowWorkspaceScan;
    wsOpt.textContent = caps.allowWorkspaceScan ? 'Workspace context' : 'Workspace (Pro/Team)';
  }
  if (!caps.allowWorkspaceScan) document.getElementById('attachment').value = 'active';
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 6000);
}

function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span>'
    : (btnId === 'btnSignIn' ? 'Sign in' : 'Create account');
}

function isValidEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

function addMessage(role, text, stats) {
  history.push({ role, text, stats });
  vscode.setState({ history: history.slice(-50) });
  renderHistory();
}

function addErrorMessage(text) {
  history.push({ role: 'error', text });
  vscode.setState({ history: history.slice(-50) });
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('result');
  if (!history.length) {
    el.innerHTML = '<span style="opacity:.5;font-size:12px">Ask ZaynAI anything about your codebase...</span>';
    return;
  }
  el.replaceChildren();
  history.forEach((m, idx) => {
    const bubble = document.createElement('div');
    if (m.role === 'error') {
      bubble.className = 'chat-msg error-msg';
      const label = document.createElement('div');
      label.className = 'chat-label';
      label.innerHTML = '<span>&#9888; Error</span>';
      const body = document.createElement('div');
      body.className = 'msg-body';
      body.textContent = m.text;
      const actions = document.createElement('div');
      actions.className = 'error-actions';
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => {
        if (!lastPrompt || !signedIn) return;
        setSending(true);
        vscode.postMessage({
          type: 'ask',
          request: { area: lastArea, prompt: lastPrompt, includeWorkspace: lastAttach === 'workspace', selectedCode: '' }
        });
      });
      actions.appendChild(retryBtn);
      bubble.append(label, body, actions);
    } else {
      bubble.className = 'chat-msg ' + m.role;
      const label = document.createElement('div');
      label.className = 'chat-label';
      const labelText = document.createElement('span');
      labelText.textContent = m.role === 'user' ? 'You' : 'ZaynAI';
      label.appendChild(labelText);
      if (m.role === 'assistant') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(m.text).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
          });
        });
        label.appendChild(copyBtn);
      }
      const body = document.createElement('div');
      body.className = 'msg-body';
      body.innerHTML = renderMarkdown(m.text);
      bubble.append(label, body);
      if (m.stats && (m.stats.added || m.stats.removed)) {
        const row = document.createElement('div');
        row.className = 'change-count';
        row.innerHTML = '<span class="added">+' + m.stats.added + ' added</span><span class="removed">-' + m.stats.removed + ' removed</span>';
        bubble.appendChild(row);
      }
    }
    el.appendChild(bubble);
  });
  el.scrollTop = el.scrollHeight;
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/^\\d+\\. (.+)$/gm, '  $1')
    .replace(/\\n/g, '<br>');
}

function setSending(sending) {
  document.getElementById('btnAsk').disabled = sending || !signedIn;
  document.getElementById('btnAsk').innerHTML = sending ? '<span class="spinner"></span>' : 'Send';
  const existing = document.getElementById('typingIndicator');
  if (existing) existing.remove();
  if (sending) {
    const el = document.getElementById('result');
    const msg = document.createElement('div');
    msg.id = 'typingIndicator';
    msg.className = 'chat-msg assistant';
    msg.innerHTML = '<div class="chat-label"><span>ZaynAI</span></div><div class="typing-dots"><span></span><span></span><span></span></div>';
    el.appendChild(msg);
    el.scrollTop = el.scrollHeight;
  }
}

function renderDashboard(items) {
  const c = { error: 0, performance: 0, security: 0, 'code-review': 0 };
  items.forEach(i => { if (c[i.category] !== undefined) c[i.category]++; });
  document.getElementById('cntErrors').textContent = c.error;
  document.getElementById('cntPerf').textContent = c.performance;
  document.getElementById('cntSec').textContent = c.security;
  document.getElementById('cntReview').textContent = c['code-review'];
  const box = document.getElementById('findings');
  box.replaceChildren();
  if (!items.length) { box.textContent = 'No structured findings.'; return; }
  items.forEach(i => {
    const d = document.createElement('div');
    d.className = 'finding ' + i.severity + ' ' + i.category;
    const loc = i.file ? i.file + (i.line ? ':' + i.line : '') : '';
    d.innerHTML =
      '<div class="finding-title">[' + i.severity.toUpperCase() + '] ' + escHtml(i.title) + '</div>' +
      (loc ? '<div class="finding-loc">' + escHtml(loc) + '</div>' : '') +
      '<div>' + escHtml(i.description) + '</div>' +
      (i.recommendation ? '<div class="finding-rec">Fix: ' + escHtml(i.recommendation) + '</div>' : '');
    box.appendChild(d);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

vscode.postMessage({ type: 'refreshAccount' });
`;
//# sourceMappingURL=webviewScript.js.map