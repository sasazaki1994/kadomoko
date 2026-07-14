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

KadoMoco uses Electron's `userData` directory. On Windows this is normally under `%APPDATA%\\KadoMoco`. The primary save is `kadomoco-save.json`; backup data is stored in `kadomoco-save-backup.json`.

## Uninstall behavior

The current NSIS configuration keeps app data on uninstall (`deleteAppDataOnUninstall: false`). This means uninstalling KadoMoco does not automatically delete saves.

To manually remove saves after uninstalling, delete the KadoMoco user data folder, normally `%APPDATA%\\KadoMoco`. Do not publish this folder or save JSON files in bug reports because they may contain personal usage history.

## SmartScreen and code signing

v0.1.0 is prepared before code signing. Windows SmartScreen may warn that the app is from an unknown publisher. Verify the download source and SHA-256 checksum before running.

## Known limitations

- Windows code signing is not configured for v0.1.0.
- SmartScreen reputation is not established.
- Public distribution is blocked until the repository owner chooses a project license.
- Windows real-device QA is still required for scaling, monitor changes, tray behavior, install, uninstall, and save retention.
