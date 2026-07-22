# Windows RC result template

Copy this file and the JSON below into `qa-results/`; do not edit the template to claim a run. Allowed statuses are `not-tested`, `passed`, `failed`, `blocked`, and `not-applicable`. Automation may attach facts, but only a tester may change visual or interaction checks from `not-tested`.

```json
{
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "commitSha": "",
  "testedAt": "",
  "tester": "",
  "environment": { "windowsVersion": "", "displayScale": "", "monitorCount": 0, "monitorLayout": "", "packageKind": "" },
  "artifacts": {
    "nsis": { "fileName": "", "sha256": "", "signatureStatus": "not-tested" },
    "zip": { "fileName": "", "sha256": "", "executableSignatureStatus": "not-tested" }
  },
  "results": [
    { "id": "display.transparent", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "display.frameless", "status": "not-tested", "evidence": "screenshots/", "notes": "" },
    { "id": "interaction.drag-and-position-persistence", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "lifecycle.tray-hide-show-quit", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "display.scales-100-125-150", "status": "not-tested", "evidence": "screenshots/", "notes": "" },
    { "id": "display.multi-monitor-restoration", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "lifecycle.sleep-resume", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "lifecycle.long-running", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "distribution.install", "status": "not-tested", "evidence": "", "notes": "" },
    { "id": "protection.smartscreen", "status": "not-tested", "evidence": "", "notes": "" }
  ],
  "knownIssues": [],
  "overallStatus": "not-tested"
}
```

Overall `passed` requires every applicable plan item to have human evidence and no failed/blocked release-critical issue. Record exact artifact SHA-256, artifact source, screenshots/log paths, issue URLs, and retest notes. Set `KADOMOCO_MANUAL_QA_REPORT` to this JSON path only when generating the readiness report; a `passed` report is accepted only for the exact current commit.
