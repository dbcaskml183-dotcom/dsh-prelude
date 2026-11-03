# Install, update, and restore Prelude

[Home](../README.en.md) · [中文](installation.md)

## Tested environments

| Environment | Verified scope |
| --- | --- |
| Windows desktop connected to DSH 0.2.1-rc.2 in WSL2, Node 24 | Desktop launcher and browser use tested. |
| Linux, DSH rc.2, Node 24 | Installation, startup, and authenticated plugin response tested. |
| Native macOS, rc.2, Node 24 | Installation, startup, authenticated status, and ledger tests passed. Desktop interactions and real model calls have not been tested there. |
| Linux and macOS, rc.3–rc.5 | Default installation is rejected by the rc.2 version declaration. Disposable tests using an explicit host version override passed installation, startup, and authenticated status checks. |
| Native Windows Node 24 | Ledger directory synchronization returned EPERM. Use WSL2 for version 0.4.21. |

[Installation checks](https://github.com/dbcaskml183-dotcom/dsh-prelude/actions/runs/41567949491) · [Other RC startup checks](https://github.com/dbcaskml183-dotcom/dsh-prelude/actions/runs/41568664094)

## Install

The display name is Prelude. The package keeps its earlier name, `dsh-prompt-coach`, for existing configurations and personal libraries.

Save your profile configuration, dependency manifest and lockfile first. Preserve copies of any locally modified plugins too.

Run in the Linux/WSL terminal hosting DSH:

```sh
dsh plugin --profile web add https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.21/dsh-prompt-coach-0.4.21.tgz --ignore-scripts
```

This exact installation was tested in a fresh WSL2 rc.2 profile. The host loaded the plugin and its authenticated status endpoint returned 0.4.21. The package includes built files, so installation scripts are unnecessary.

Use your actual profile name instead of `web` when different. Use the same CLI version as the running host. For an offline copy, replace the URL with the downloaded file's absolute path. A Windows file at `D:\Downloads\dsh-prompt-coach-0.4.21.tgz` is normally `/mnt/d/Downloads/dsh-prompt-coach-0.4.21.tgz` inside WSL.

## Restart and check

Save drafts and wait for active tasks to finish. Restart DSH through the launcher or service manager that normally runs it, then refresh the browser. For a manually launched host, stop that terminal process normally and rerun its original command with the same profile and environment.

Open Prelude from the composer, search for “验收标准”, and insert a snippet. Check that the original draft remains and no message was automatically sent. Settings should show Prelude 0.4.21.

## Update and restore

Stop plugin writes before backing up the old package, profile configuration and lockfile, and the entire `${DSH_HOME:-$HOME/.dsh}/prompt-coach` state directory. State lives outside the installation directory.

Install the new package, restart, and check it. Before rollback, preserve any data added since the upgrade. Restore a matching program, configuration and state snapshot while writes are stopped. Restoring older state can lose later changes.

## Remove the plugin

```sh
dsh plugin --profile web remove dsh-prompt-coach
```

Restart and refresh. Removing the package leaves the personal library in place.
