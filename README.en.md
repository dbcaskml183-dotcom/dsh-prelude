# Prelude

A prompt-writing assistant for DeepSeek Harness. Choose a method, add a missing requirement, and compare the rewrite with your draft before applying it.

[Download 0.4.21](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz) · [Installation (中文)](docs/installation.md) · [简体中文](README.md)

![Prelude method library showing a method card and the actions to use, insert, or copy its guidance](docs/assets/method-library.png)

## Get started

Write a request in DSH and open **Prelude**. Browse 90 method cards (primarily in Chinese), or ask Prelude to suggest additions. Insert a snippet directly, or select methods for a full rewrite. Compare and edit the candidate before applying it to the composer. You decide when to send.

For example, a request to convert CSV to JSON can specify a sample input and its expected output. This gives the recipient a concrete way to check the script.

Browsing methods is local. Analysis, rewriting, and optional review use the model provider configured in DSH and may incur charges. Conversation excerpts and text attachments are included only when selected.

**Tested on Windows desktop** with a Windows launcher or browser connected to DSH 0.2.1-rc.2 in WSL2. Linux and native macOS also passed installation, startup, and an authenticated plugin status check on that host version.

[Compatibility results (中文)](docs/installation.md#支持环境) · [Usage (中文)](docs/quickstart.md) · [Report an issue](https://github.com/dbcaskml183-dotcom/dsh-prelude/issues/new/choose) · [MIT License](LICENSE)
