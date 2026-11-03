# Prelude

A prompt-writing assistant for DeepSeek Harness. Choose a method, add a missing requirement, and compare the rewrite with your draft before applying it.

[Download 0.4.21](https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz) · [Installation (中文)](docs/installation.md) · [简体中文](README.md)

![Prelude method library showing a method card and the actions to use, insert, or copy its guidance](docs/assets/method-library.png)

## A rewrite in practice

**Draft:** “Convert CSV to JSON using the Python standard library. Keep the original file.”

**One possible rewrite with the acceptance criteria method:** “Convert CSV to JSON using the Python standard library. Keep the original file. Include a small CSV sample, the expected JSON, and the command I can run to check the result.”

The addition explains how to verify the script while preserving both original constraints.

## Try it in the DSH composer

| What you want | What to do |
| --- | --- |
| Add one specific requirement | Browse the 90 method cards (primarily in Chinese) and insert a snippet at the cursor. |
| Find a gap in your request | Analyze the draft, read the suggested additions, and choose what applies. |
| Bring several requirements together | Select methods, generate a rewrite, and compare it with the original. Edit the candidate before applying it to the composer. You decide when to send. |

Save phrases you use often in your personal library for next time.

Browsing methods is local. Analysis, rewriting, and optional review use the model provider configured in DSH and may incur charges. Conversation excerpts and text attachments are included only when selected.

**Tested on Windows desktop** with a Windows launcher or browser connected to DSH 0.2.1-rc.2 in WSL2. Linux and native macOS also passed installation, startup, and an authenticated plugin status check on that host version.

[Compatibility results (中文)](docs/installation.md#支持环境) · [Usage (中文)](docs/quickstart.md) · [Report an issue](https://github.com/dbcaskml183-dotcom/dsh-prelude/issues/new/choose) · [MIT License](LICENSE)
