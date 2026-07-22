# v0.1.0 release decision

- Decision: **HOLD / GO**
- Commit and artifact SHA-256:
- Automated readiness JSON/Markdown:
- Windows manual QA JSON/Markdown:
- Performance JSON/Markdown (30 minute and >=2 hour):
- Signing status and Authenticode report:
- Reviewer/date:

## Evidence review

| Gate | Status | Evidence / exceptions |
| --- | --- | --- |
| Automated Linux/Windows qualification | not-run | |
| IPC validation | not-run | |
| Save compatibility (version 9, primary/backup) | not-tested | |
| Windows 10 matrix | not-tested | |
| Windows 11 matrix | not-tested | |
| NSIS/ZIP lifecycle and compatibility | not-tested | |
| 30-minute idle measurement | not-run | |
| >=2-hour soak | not-tested | |
| Authenticode / unsigned disclosure | not-tested | |
| Defender / actual SmartScreen | not-tested | |

## Issues, mitigations, rollback

List release blockers, accepted risks with owner/date, user-facing unsigned warning, and rollback instructions. Automated success never changes manual rows to passed.
