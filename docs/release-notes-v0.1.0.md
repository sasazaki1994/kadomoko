# KadoMoco v0.1.0 Release Notes

KadoMoco v0.1.0 is the first release-candidate foundation for a tiny desktop-resident pixel companion.

## Highlights

- A small companion that lives quietly on the desktop.
- Four care actions: food, petting, play, and rest.
- Status, level, daily routine, personality, observations, journals, dreams, discoveries, breathing, and focus interactions.
- Save data persistence with backup recovery for safer upgrades and restarts.
- Production sprite sheet and generated official application icons.
- Windows distribution as NSIS installer and ZIP package.
- Automated validation for sprites, icons, unit tests, Electron E2E, and packaged Windows artifacts.

## Installation

See `docs/install-and-uninstall.md` for NSIS and ZIP installation, complete exit, save-data location, uninstall behavior, SmartScreen notes, and known limitations.

## Release candidate notes

- v0.1.0 is not code-signed. Windows SmartScreen may show a warning until signing and reputation are established.
- The GitHub Release workflow creates a draft release from a matching `v0.1.0` tag; it does not publish automatically.
- The project distribution license is not decided yet and remains a public-release blocker.
