# Install and uninstall KadoMoco v0.1.0

## NSIS installer

1. Download `KadoMoco-0.1.0-x64.exe` from the draft or published GitHub Release.
2. Run the installer.
3. Choose the install location if prompted.
4. Launch KadoMoco from the installed shortcut or executable.

## ZIP package

1. Download `KadoMoco-0.1.0-x64.zip`.
2. Extract the ZIP to a writable folder.
3. Run `KadoMoco.exe` from the extracted folder.

## Complete exit

Closing the window hides KadoMoco to the tray. To fully exit, use the tray menu or in-app right-click menu and choose `終了`.

## Save data location

KadoMoco uses Electron's `userData` directory. On Windows this is normally under `%APPDATA%\KadoMoco`. The primary save is `kadomoco-save.json`; backup data is stored in `kadomoco-save-backup.json`.

## Uninstall behavior

The current NSIS configuration keeps app data on uninstall (`deleteAppDataOnUninstall: false`). This means uninstalling KadoMoco does not automatically delete saves.

To manually remove saves after uninstalling, delete the KadoMoco user data folder, normally `%APPDATA%\KadoMoco`. Do not publish this folder or save JSON files in bug reports because they may contain personal usage history.

## SmartScreen and code signing

v0.1.0 and an emergency v0.1.1 may be distributed unsigned. Windows SmartScreen may warn that the app is from an unknown publisher. Download only from GitHub Releases or another project-designated official source and verify the SHA-256 checksums for both NSIS and ZIP before running. Do not disable Defender or SmartScreen.

## Known limitations

- Windows code signing is not configured for v0.1.0.
- SmartScreen reputation is not established.
- Windows real-device QA is still required for scaling, monitor changes, tray behavior, install, uninstall, and save retention.

## RC artifact verification

RC artifacts are produced by the manual **RC Qualification** workflow, not by a GitHub Release. Download `kadomoco-windows-rc-<version>-<short-sha>` from the workflow run and extract it locally.

Verify SHA-256 checksums before installing or launching:

```powershell
Get-FileHash .\KadoMoco-0.1.0-x64.exe -Algorithm SHA256
Get-FileHash .\KadoMoco-0.1.0-x64.zip -Algorithm SHA256
Get-Content .\KadoMoco-0.1.0-x64.exe.sha256
Get-Content .\KadoMoco-0.1.0-x64.zip.sha256
```

Run the QA helper from a checkout of the same source revision:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-rc-qa.ps1 `
  -ArtifactDirectory .\release `
  -ReportPath .\qa-results\windows-rc-result.json `
  -LaunchSmoke
```

The helper does not require administrator privileges, does not uninstall or delete files, and does not intentionally modify existing saves. `NotSigned` is recorded as a warning for v0.1.0 RC builds; signature states such as hash mismatch or untrusted signatures are failures.

Record manual results with `docs/qa/windows-rc-result-template.md` and make the final release decision with `docs/qa/release-decision-template.md`. The proprietary project license is already recorded in LICENSE, README, package metadata, and release notes; Windows real-device QA remains a separate release decision input.
