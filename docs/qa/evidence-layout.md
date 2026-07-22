# v0.1.0 RC evidence layout

Keep tester-created evidence outside Git unless it has been reviewed for privacy. Never include a personal name, machine name, user-directory path, raw save data, certificate, key, password, or Base64 certificate material.

```text
qa-results/v0.1.0-rc.1/
  windows-10/
    windows-rc-result.json
    windows-rc-result.md
    screenshots/
    notes.md
  windows-11/
    windows-rc-result.json
    windows-rc-result.md
    screenshots/
    notes.md
  performance/
    30min/
    120min/
  release-decision.md
```

Run `scripts/windows-rc-qa.ps1` separately on real Windows 10 and Windows 11 systems, using the matching directory as `ReportPath`. Copy the result template for human-only visual and interaction checks. Run `scripts/windows-performance-soak.ps1` separately for 30 and at least 120 minutes. A reviewer must confirm the commit and package hashes match across every report before changing the decision from **NO-GO**.
