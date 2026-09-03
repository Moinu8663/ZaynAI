# ZaynAI — Developer Assistant

A VS Code AI assistant for the software-development lifecycle.

## Capabilities

- Architecture
- Coding
- Debugging
- Migration
- Testing
- Database / SQL
- DevOps / CI-CD
- Security
- Performance
- Reports / files
- Documentation
- UI / UX
- Code review
- Automation

## AI Provider Settings

Open:

`Ctrl+Shift+P` -> `Preferences: Open Settings (UI)`

Search:

`ZaynAI`

You can configure:

- Provider: OpenAI / Azure OpenAI / Gemini / Custom API
- Model
- Endpoint
- Workspace context limits

When **Auto Fetch Explorer Files** is enabled (the default), every request includes
the active editor and relevant files from the Explorer. Files named in the request
are prioritized, giving Gemini, Codex-style OpenAI models, and other providers the
same automatic workspace context.

## Autonomous edits and quality dashboard

For coding, testing, debugging, security, performance, and code-review requests,
the assistant returns structured findings and complete file updates. With **Auto
Apply Generated Changes** enabled (the default), valid updates are written directly
to the trusted workspace, including new test files. Use the ZaynAI menu to preview
the latest proposal in VS Code's native side-by-side diff. Generated paths cannot
leave the workspace.

The ZaynAI sidebar also shows a quality dashboard after every structured analysis,
grouping findings into errors, performance, security, and code-review categories.

For Gemini, choose `Gemini` as the provider and set a Gemini model such as
`gemini-2.5-pro`. Leave the endpoint at its default to use Google's Gemini API, or
set it to a compatible Gemini API base URL.

## API Key

API keys are stored per provider using VS Code SecretStorage. This lets you keep a
Gemini key alongside keys for OpenAI, Azure OpenAI, or a custom provider.

Use:

`Ctrl+Shift+P` -> `ZaynAI: Change API Key`

or:

`Ctrl+Shift+P` -> `ZaynAI: Clear API Key`

The key is not stored in `settings.json`, source code or `package.json`.

## Build

```bash
npm install
npm run compile
```

Run the extension:

`F5`

Package it:

```bash
npm run package
```

Install the resulting `.vsix` from VS Code -> Extensions -> `...` -> Install from VSIX.
