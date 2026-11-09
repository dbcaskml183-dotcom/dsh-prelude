# Install, update, and restore Prelude

[Home](../README.en.md) · [中文](installation.md)

## Tested environments

Version 0.4.28 supports Node 24+ and DSH 0.2.1-rc.2 through rc.5, plus 0.2.2-rc.1 on Linux / WSL2, macOS, and native Windows. Native Windows was tested with rc.5. Default installation needs no version override. Later host versions remain outside the declared range until tested.

| Environment | Verified scope |
| --- | --- |
| Windows desktop connected to DSH in WSL2 | Windows launcher or browser connected to DSH running inside WSL2; desktop interactions verified. Install the plugin inside WSL. |
| Linux, DSH rc.2 / rc.3 / rc.4 / rc.5 | Clean official host installation, boot, authenticated status, favorite write and persistence after restart; native storage tests. |
| macOS, DSH rc.2 / rc.3 / rc.4 / rc.5 | The same checks on GitHub macOS runners, not manual desktop interaction or real model validation. |
| Native Windows Node | Native Windows · Node 24 · DSH rc.5: installation, startup, plugin response, and saving favorites verified. |

The method library, favorites and snippet insertion were exercised on native Windows with the 0.2.2-rc.1 web host. [Compatibility evidence](../VERIFICATION.md)

## Install

The display name is Prelude. The package keeps its earlier name, `dsh-prompt-coach`, for existing configurations and personal libraries.

Save your profile configuration, dependency manifest and lockfile first. Preserve copies of any locally modified plugins too.

Install the npm channel in the host terminal. To pin this version, use `dsh-prompt-coach@0.4.28`. In the desktop app, select this version in the plugin manager.

```sh
dsh plugin --profile web add dsh-prompt-coach --ignore-scripts
```

Or install this release directly (including Windows PowerShell):

```sh
dsh plugin --profile web add https://github.com/dbcaskml183-dotcom/dsh-prelude/releases/download/v0.4.28/dsh-prompt-coach-0.4.28.tgz --ignore-scripts
```

The same packaged artifact is used for cross-platform verification and publication. The package includes built files, so installation scripts are unnecessary.

Use your actual profile name instead of `web` when different. Use the same CLI version as the running host. For an offline copy, replace the URL with the downloaded file's absolute path. A Windows file at `D:\Downloads\dsh-prompt-coach-0.4.28.tgz` is normally `/mnt/d/Downloads/dsh-prompt-coach-0.4.28.tgz` inside WSL.

## Restart and check

Save drafts and wait for active tasks to finish. Restart DSH through the launcher or service manager that normally runs it, then refresh the browser. For a manually launched host, stop that terminal process normally and rerun its original command with the same profile and environment.

Open Prelude from the composer, search for “验收标准”, and insert a snippet. Check that the original draft remains and no message was automatically sent. Settings should show Prelude 0.4.28.

## Update and restore

Stop plugin writes before backing up the old package, profile configuration and lockfile, and the entire `${DSH_HOME:-$HOME/.dsh}/prompt-coach` state directory. State lives outside the installation directory.

Install the new package, restart, and check it. Before rollback, preserve any data added since the upgrade. Restore a matching program, configuration and state snapshot while writes are stopped. Restoring older state can lose later changes.

## Remove the plugin

```sh
dsh plugin --profile web remove dsh-prompt-coach
```

Restart and refresh. Removing the package leaves the personal library in place.
