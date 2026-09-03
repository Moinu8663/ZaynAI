# ZaynAI — User Manual

Version 0.2.0

---

## Table of Contents

1. [What Is ZaynAI?](#1-what-is-zaynai)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [First-Time Setup — Backend](#4-first-time-setup--backend)
5. [Creating Your Account](#5-creating-your-account)
6. [Signing In](#6-signing-in)
7. [Subscription Plans](#7-subscription-plans)
8. [The Chat Panel](#8-the-chat-panel)
9. [AI Areas (Modes)](#9-ai-areas-modes)
10. [Workspace Context & File Attachment](#10-workspace-context--file-attachment)
11. [Autonomous Code Changes](#11-autonomous-code-changes)
12. [Quality Dashboard](#12-quality-dashboard)
13. [Command Palette Commands](#13-command-palette-commands)
14. [Right-Click Editor Menu](#14-right-click-editor-menu)
15. [Managing Your Subscription](#15-managing-your-subscription)
16. [Signing Out](#16-signing-out)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What Is ZaynAI?

ZaynAI is a VS Code extension that connects your editor to a
hosted AI backend powered by Google Gemini. You do **not** need your own API
key — access is managed entirely through your account and subscription plan.

Key highlights:

- Chat with AI directly inside the VS Code sidebar
- 14 specialist AI modes (Architecture, Coding, Security, DevOps, and more)
- Automatic workspace context — the AI reads your open files
- Autonomous file edits written directly to your workspace
- Per-plan capability badges (model name, code changes, workspace scan)
- Quality dashboard showing errors, performance, security, and review findings

---

## 2. Requirements

| Requirement | Minimum version |
|---|---|
| Visual Studio Code | 1.95.0 |
| Node.js (for backend) | 18+ |
| .NET SDK (for backend) | 8.0+ |
| SQL Server LocalDB | Included with Visual Studio |

The backend (`AiDevAssistant.Api`) must be running locally for the extension
to work. See Section 4.

---

## 3. Installation

### Install from VSIX

1. Open VS Code.
2. Open the Extensions panel (`Ctrl+Shift+X`).
3. Click the `···` menu at the top-right of the panel.
4. Select **Install from VSIX…**
5. Browse to `ai-dev-assistant-0.2.0.vsix` and click **Install**.
6. Reload VS Code when prompted.

After installation, the **ZaynAI** icon appears in the Activity Bar on the
left side of VS Code.

---

## 4. First-Time Setup — Backend

The extension talks to a local .NET API. You must start it before using the
extension.

### 4.1 Set up the database

Run the three SQL scripts in order against your LocalDB instance
(`(localdb)\MSSQLLocalDB`):

```
AiDevAssistant.Api/Database/00_create_database.sql
AiDevAssistant.Api/Database/01_schema.sql
AiDevAssistant.Api/Database/02_stored_procedures.sql
```

You can run them using SQL Server Management Studio, Azure Data Studio, or
the `sqlcmd` command-line tool:

```bash
sqlcmd -S "(localdb)\MSSQLLocalDB" -i 00_create_database.sql
sqlcmd -S "(localdb)\MSSQLLocalDB" -i 01_schema.sql
sqlcmd -S "(localdb)\MSSQLLocalDB" -i 02_stored_procedures.sql
```

### 4.2 Start the API

Open a terminal in the `AiDevAssistant.Api` folder and run:

```bash
dotnet run
```

The API starts on `http://localhost:5206`. Keep this terminal open while
using the extension.

### 4.3 Verify the backend is running

Open a browser and navigate to:

```
http://localhost:5206/api/plans
```

You should see a JSON list of the three subscription plans. If you see an
error, check that the database scripts ran successfully and the connection
string in `appsettings.json` is correct.

---

## 5. Creating Your Account

1. Click the **ZaynAI** icon in the Activity Bar to open the chat panel.
2. The **Auth screen** appears. Click **Create account**.
3. Fill in:
   - **Full name** — your display name
   - **Email** — your email address
   - **Password** — minimum 8 characters
   - **Plan** — choose from Free, Pro, or Team (see Section 7)
4. Click **Create account**.
5. On success the chat screen opens automatically.

---

## 6. Signing In

If you already have an account:

1. Open the chat panel.
2. Enter your **Email** and **Password** on the Sign in tab.
3. Click **Sign in**.

Your session is stored securely using VS Code's built-in secret storage. You
stay signed in across VS Code restarts until you explicitly sign out.

### Sign in via Command Palette

You can also sign in without opening the panel:

```
Ctrl+Shift+P  →  ZaynAI: Sign In
```

---

## 7. Subscription Plans

| Plan | Price | AI Model | Requests/month | Workspace Scan | Code Changes |
|---|---|---|---|---|---|
| **Free** | $0/mo | gemini-2.0-flash | Limited | ✗ | ✗ |
| **Pro** | Paid | gemini-2.5-flash | Higher limit | ✓ | ✓ |
| **Team** | Paid | gemini-2.5-pro | Highest limit | ✓ | ✓ |

- **Free** — basic Q&A only. No file edits, no workspace scan.
- **Pro** — full coding assistant with file edits and workspace context.
- **Team** — highest-capability Gemini model with the largest output window.

Your active plan and its capabilities are shown as badges at the top of the
chat panel after sign-in.

To change your plan, see Section 15.

---

## 8. The Chat Panel

Open the panel by clicking the **ZaynAI** icon in the Activity Bar.

### Layout

```
┌─────────────────────────────────┐
│  Avatar  Name          ⚙  ↩    │  ← top bar
│  [Model badge] [Code] [Scan]    │  ← capability badges
├─────────────────────────────────┤
│                                 │
│   Chat history                  │  ← scrollable message area
│                                 │
├─────────────────────────────────┤
│  [Area dropdown]                │
│  [Prompt textarea]              │  ← composer
│  [Attachment]        [Send]     │
├─────────────────────────────────┤
│  ▶ Quality dashboard            │  ← collapsible
└─────────────────────────────────┘
```

### Sending a message

1. Select an **Area** from the dropdown (e.g. Coding, Security).
2. Type your question or instruction in the **prompt** box.
3. Choose an attachment mode:
   - **Attach: file + workspace** — sends the active file and relevant
     workspace files as context (recommended).
   - **Attach: active file only** — sends only the currently open file.
4. Click **Send** or press `Ctrl+Enter`.

The AI response appears in the chat history. File changes (if any) are
applied automatically and reported below the response.

---

## 9. AI Areas (Modes)

Select the area that matches your task for the most focused response.

| Area | What it does |
|---|---|
| **Architecture** | System design, component diagrams, scalability advice |
| **Coding** | Write, refactor, or explain code |
| **Debugging** | Diagnose errors, stack traces, and runtime issues |
| **Migration** | Upgrade frameworks, languages, or database schemas |
| **Testing** | Generate unit and integration tests |
| **Database** | SQL queries, schema design, stored procedures |
| **DevOps** | CI/CD pipelines, Docker, Kubernetes, deployment scripts |
| **Security** | Vulnerability analysis, OWASP checks, hardening advice |
| **Performance** | Bottleneck detection, profiling, optimization |
| **Documentation** | Generate README, API docs, inline comments |
| **UI / UX** | Component design, accessibility, layout advice |
| **Code Review** | Production-grade review covering correctness and maintainability |
| **Automation** | Scripts, task runners, workflow automation |
| **General** | Open-ended questions not covered by the above |

---

## 10. Workspace Context & File Attachment

When **Attach: file + workspace** is selected, the extension automatically:

- Reads the currently active editor file
- Scans up to 80 workspace files relevant to your prompt
- Prioritizes files whose names appear in your prompt

This gives the AI full context about your project without you having to
copy-paste code manually.

> **Pro / Team plans only.** The Free plan does not include workspace scan.
> The capability badge at the top of the panel shows whether workspace scan
> is enabled for your plan.

### Limits (configurable in Settings)

| Setting | Default | Description |
|---|---|---|
| `zaynai.maxWorkspaceFiles` | 80 | Max files included in context |
| `zaynai.maxFileChars` | 12,000 | Max characters read per file |

---

## 11. Autonomous Code Changes

For Coding, Testing, Debugging, Security, Performance, and Code Review
requests, the AI can return complete file updates alongside its explanation.

### Auto-apply (default: ON)

When **Auto Apply Generated Changes** is enabled, valid file updates are
written directly to your workspace as soon as the response arrives. The chat
message shows:

```
Applied files:
- src/services/userService.ts
- src/tests/userService.test.ts
+42 added  -7 removed
```

### Preview before applying

To review a proposed change before it is written:

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Run **ZaynAI: Preview Generated Changes**.
3. VS Code opens a side-by-side diff view showing the current file vs. the
   proposed update.
4. To apply after reviewing, run **ZaynAI: Apply Generated Changes**.

### Disable auto-apply

Go to `Ctrl+Shift+P` → **Preferences: Open Settings (UI)** → search
`ZaynAI` → uncheck **Auto Apply Generated Changes**.

> Generated file paths are sandboxed to your workspace. The AI cannot write
> files outside the open workspace folder.

---

## 12. Quality Dashboard

The **Quality dashboard** section at the bottom of the chat panel is
populated after every structured analysis (Code Review, Security,
Performance, Debugging).

| Counter | What it counts |
|---|---|
| **Errors** | Logic errors, exceptions, null references |
| **Perf** | Performance bottlenecks and inefficiencies |
| **Security** | Vulnerabilities, exposed secrets, injection risks |
| **Review** | Maintainability, naming, and best-practice issues |

Each finding shows:

- Severity level (e.g. `[HIGH]`)
- Title and description
- File name and line number (when available)

Click the **Quality dashboard** summary bar to expand or collapse it.

---

## 13. Command Palette Commands

Open the Command Palette with `Ctrl+Shift+P` and type `ZaynAI` to see all
available commands.

| Command | Description |
|---|---|
| **ZaynAI: Ask Assistant** | Open a prompt for a general question |
| **ZaynAI: Analyze Workspace** | Run an architecture analysis of the workspace |
| **ZaynAI: Explain Selected Code** | Explain the highlighted code |
| **ZaynAI: Review Selected Code** | Production-grade review of highlighted code |
| **ZaynAI: Generate Tests** | Generate tests for the highlighted code |
| **ZaynAI: Fix Error / Stack Trace** | Diagnose and fix an error |
| **ZaynAI: Design Architecture** | Architecture planning prompt |
| **ZaynAI: Security Review** | Security analysis prompt |
| **ZaynAI: Performance Review** | Performance analysis prompt |
| **ZaynAI: Migration Assistant** | Migration planning prompt |
| **ZaynAI: DevOps / CI-CD** | DevOps and pipeline prompt |
| **ZaynAI: Database / SQL** | Database and SQL prompt |
| **ZaynAI: Generate Documentation** | Documentation generation prompt |
| **ZaynAI: UI / UX Assistant** | UI/UX design prompt |
| **ZaynAI: Automation Assistant** | Automation scripting prompt |
| **ZaynAI: Preview Generated Changes** | Diff view of the latest proposed file changes |
| **ZaynAI: Apply Generated Changes** | Write pending proposed changes to disk |
| **ZaynAI: Insert Last Response** | Insert the last AI response at the cursor |
| **ZaynAI: Sign In** | Sign in to your account |
| **ZaynAI: Sign Up** | Create a new account |
| **ZaynAI: Sign Out** | Sign out of your account |
| **ZaynAI: Manage Subscription** | Open the subscription portal |

> All AI commands require an active signed-in account. If you are not signed
> in, the command shows an error message prompting you to sign in.

---

## 14. Right-Click Editor Menu

Select code in the editor, right-click, and choose from the **ZaynAI**
group:

| Menu item | Equivalent command |
|---|---|
| ZaynAI: Explain Selected Code | `zaynai.explainCode` |
| ZaynAI: Review Selected Code | `zaynai.reviewCode` |
| ZaynAI: Generate Tests | `zaynai.generateTests` |

These commands require a non-empty selection. If nothing is selected, a
warning appears asking you to select code first.

---

## 15. Managing Your Subscription

### Open the subscription portal

```
Ctrl+Shift+P  →  ZaynAI: Manage Subscription
```

This opens the web portal (`http://127.0.0.1:4200`) in your browser where
you can:

- View your current plan and usage
- Upgrade or downgrade your plan
- Cancel your subscription

You can also click the **⚙** (gear) icon in the top-right of the chat panel.

### Quota enforcement

Each plan has a monthly request limit. When you reach the limit, the
assistant returns a `402` error and prompts you to upgrade. Your quota resets
at the start of each billing month.

---

## 16. Signing Out

Click the **↩** (sign out) icon in the top-right of the chat panel, or run:

```
Ctrl+Shift+P  →  ZaynAI: Sign Out
```

Your token is deleted from VS Code's secret storage. The panel returns to
the sign-in screen.

---

## 17. Troubleshooting

### Error: "Assistant API 403"

**Cause:** Your JWT token has expired (tokens last 12 hours) or your
subscription is not active.

**Fix:**
1. Sign out: `Ctrl+Shift+P` → **ZaynAI: Sign Out**
2. Sign back in with your email and password.
3. If the error persists, open the subscription portal and check that your
   plan status is **Active**.

---

### Error: "Sign in to use ZaynAI"

**Cause:** You are not signed in, or the session expired.

**Fix:** Sign in via the chat panel or `Ctrl+Shift+P` → **ZaynAI: Sign In**.

---

### Error: "An active subscription is required"

**Cause:** Your account exists but the subscription status is not Active
(e.g. cancelled or payment failed).

**Fix:** Run **ZaynAI: Manage Subscription** and reactivate your plan.

---

### Error: "Authentication failed (401)"

**Cause:** Wrong email or password, or the token is invalid.

**Fix:** Sign out and sign in again with the correct credentials.

---

### Error: "Could not load plans" on the sign-up form

**Cause:** The backend API is not running.

**Fix:** Start the API:
```bash
cd AiDevAssistant.Api
dotnet run
```
Then reload the sign-up form.

---

### The chat panel shows the auth screen even after signing in

**Cause:** The backend returned an error when verifying your token (e.g. API
is down), so the session was cleared automatically.

**Fix:** Ensure the API is running on `http://localhost:5206`, then sign in
again.

---

### Workspace scan not working / badge shows "off"

**Cause:** Your plan is Free, which does not include workspace scan.

**Fix:** Upgrade to Pro or Team via **ZaynAI: Manage Subscription**.

---

### Code changes are not being applied automatically

**Cause:** Auto Apply Generated Changes may be disabled.

**Fix:** `Ctrl+Shift+P` → **Preferences: Open Settings (UI)** → search
`ZaynAI` → enable **Auto Apply Generated Changes**.

Alternatively, apply manually: `Ctrl+Shift+P` → **ZaynAI: Apply Generated
Changes**.

---

### VSIX install error: "End of central directory record signature not found"

**Cause:** The `.vsix` file is corrupted or was built with invalid
dependencies.

**Fix:** Rebuild the extension from source:
```bash
cd ai-dev-assistant-v0.2.0
npm install
npm run compile
npx @vscode/vsce package --allow-missing-repository
```
Then install the freshly generated `.vsix`.

---

*ZaynAI v0.2.0 — Built with Google Gemini*
