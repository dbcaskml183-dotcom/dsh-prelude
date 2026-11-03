# Prelude

**Write clearer requests, right inside DSH.**

[简体中文](README.md) · [Getting started](docs/quickstart.md) · [Installation](docs/installation.md)

Prelude is a prompt assistant embedded in DeepSeek Harness. Explore prompting methods, choose additional requirements, compare a rewritten draft, and decide what to use—without leaving the conversation editor.

## What it does

- **90 method cards:** recognizable terms, plain-language explanations, stages, domains, sources, and reusable snippets. The current library is primarily in Chinese.
- **Optional AI analysis:** suggestions grounded in the current draft, including the possibility that nothing needs adding.
- **User-selected guidance:** choose methods for a rewrite; recommendations are not silently applied.
- **Draft comparison:** inspect differences, edit the candidate, optionally review it, and explicitly apply it to the composer.
- **Personal library:** save snippets, favorite methods, and manage imports, exports, and recovery in settings.
- **Adjustable panel:** move and resize it, select a host-configured model, and choose which sections open by default.

Applying a draft does not send it. Undo is available when the draft and host state still permit it; subsequent edits are not silently overwritten.

## Quick start

1. Write a request in DSH and open **Prelude**.
2. Browse methods or analyze the prompt. Select useful additions if needed.
3. Generate a rewrite and compare it with the original.
4. Apply, copy, edit, or keep the original. Send it yourself when ready.

A clear prompt may need no changes. A successful review is not a guarantee of better model output.

## Install

Version **0.4.21** is a preview. Install the supplied TGZ package; this project is not distributed through npm.

Supported target: **DSH 0.2.1-rc.2 on Linux / WSL2, Node.js 24, and modern Chromium**. Native Windows/macOS hosts and other DSH versions are not currently supported. Windows browsers can connect to a WSL host.

The public project is named `dsh-prelude`; the installation package remains `dsh-prompt-coach` for compatibility. Use the supplied [package](release/dsh-prompt-coach-0.4.21.tgz), not an unverified npm package with the same name.

```sh
dsh plugin --profile web add /absolute/path/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
dsh --profile web --dump-config
```

Run these commands in the Linux/WSL environment hosting DSH. Back up your profile and plugin state first, then normally reload the same profile and refresh the browser. See [installation and recovery](docs/installation.md) for details in Chinese.

## Models, data, and limits

Local method browsing does not call a model. AI features use a model already configured in DSH and may incur provider charges. Follow the conversation model or select a fixed one; compatibility depends on the host adapter and provider.

Only the current draft is used by default. Conversation excerpts and readable text attachments require explicit selection. Prelude does not automatically scan your conversations, local folders, or second brain. Extra model review is off by default.

Full rewrites accept up to 4,000 characters and candidates up to 6,000. Special host commands or references may be copy-only. Mobile-sized layouts have been checked; physical phone testing is still outstanding.

## More

[Usage](docs/quickstart.md) · [Privacy](docs/privacy.md) · [Compatibility](docs/compatibility.md) · [Contributing](CONTRIBUTING.md) · [Verification](VERIFICATION.md) · [Sources](docs/method-sources.md)

[MIT License](LICENSE). Independent community project; not affiliated with or endorsed by DeepSeek.
