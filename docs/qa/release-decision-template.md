# v0.1.0 release decision

- Decision: **NO-GO / GO**
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
| Installer and ZIP executable Authenticode / unsigned disclosure | not-tested | |
| Defender / actual SmartScreen | not-tested | |

## Issues, mitigations, rollback

List release blockers, accepted risks with owner/date, user-facing unsigned warning, and rollback instructions. Automated success never changes manual rows to passed.

**Release decision criteria:**
- Any FAILED automated qualification gate or FAILED Windows device QA gate must be recorded as **NO-GO**. Failure is distinct from "not-run/not-tested" and must not be silently treated as passed.
- Every applicable gate in the Evidence review table must be either Passed, or have an explicitly approved/documented exception (with owner/date) before a **GO** decision is permitted. This includes successful automated qualification AND reviewed Windows QA evidence.
- Record **NO-GO** while either Windows version, either soak, RC feedback, or commit-matched evidence remains incomplete.

For v0.1.0 and an emergency v0.1.1, unsigned distribution is permitted only from GitHub Releases or another designated official source with both package SHA-256 values and a SmartScreen warning. Do not advise disabling Defender or SmartScreen.
