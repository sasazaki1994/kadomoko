# Changelog

All notable changes to KadoMoco are documented in this file. This project follows a Keep a Changelog-style format.

## [0.1.0] - Release Candidate

### Added
- Desktop-resident tiny companion designed to stay near the edge of the Windows desktop.
- Four care actions: food, petting, play, and rest.
- Status, level, daily routine, personality, observations, journals, and weekly reflection surfaces.
- Save data sanitation, versioned migration, and backup recovery behavior.
- Production pixel sprite sheet, dreams, discoveries, breathing, and focus features.
- Windows NSIS installer and ZIP packaging targets.
- Automated unit tests, Electron E2E smoke tests, sprite validation, icon validation, license notice validation, and Windows package verification.
- Reproducible app icon generation from the production sprite sheet.

### Changed
- Windows packaging is prepared to use the official app ICO and packaged tray icon assets.
- Established KadoMoco as proprietary, All Rights Reserved software and separated its terms from third-party dependency licenses.

### Known limitations
- v0.1.0 is not code-signed, so Windows SmartScreen may warn on first launch.
