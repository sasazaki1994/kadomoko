# Windows RC Test Plan for KadoMoco v0.1.0

Use this plan only for Release Candidate qualification. Do not mark an item complete until it was tested on a real Windows environment.

## RC evidence record

- Automated readiness report (`artifacts/release-readiness.md` or workflow artifact URL):
- RC artifact names:
- Commit SHA:
- SHA-256 verification result:
- Test date:
- Tester:
- Windows version:
- Display scale:
- Monitor configuration:
- Failure issue number(s):
- Screenshot / video / log location:

The automated readiness report and this real-device plan are separate evidence. A passing automated report does not change any manual row from `NOT TESTED`.

## Result format

For every row record: `PASS`, `FAIL`, `NOT TESTED`, or `NOT APPLICABLE`, plus environment, steps, actual result, evidence, issue number, and notes.

| Area | Item | Status | Environment | Steps | Actual result | Evidence | Issue | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Environment | Windows 10 | NOT TESTED |  |  |  |  |  |  |
| Environment | Windows 11 | NOT TESTED |  |  |  |  |  |  |
| Environment | 100% display scale | NOT TESTED |  |  |  |  |  |  |
| Environment | 125% display scale | NOT TESTED |  |  |  |  |  |  |
| Environment | 150% display scale | NOT TESTED |  |  |  |  |  |  |
| Environment | 1 monitor | NOT TESTED |  |  |  |  |  |  |
| Environment | Multiple monitors | NOT TESTED |  |  |  |  |  |  |
| Environment | Negative-coordinate secondary monitor | NOT TESTED |  |  |  |  |  |  |
| Environment | Switch primary monitor | NOT TESTED |  |  |  |  |  |  |
| Environment | Change resolution | NOT TESTED |  |  |  |  |  |  |
| Environment | Changed taskbar position | NOT TESTED |  |  |  |  |  |  |
| Install | Fresh NSIS install | NOT TESTED |  |  |  |  |  |  |
| Install | Choose alternate install directory | NOT TESTED |  |  |  |  |  |  |
| Install | ZIP extract and launch | NOT TESTED |  |  |  |  |  |  |
| Install | Overwrite install | NOT TESTED |  |  |  |  |  |  |
| Install | Uninstall | NOT TESTED |  |  |  |  |  |  |
| Install | Save kept after uninstall | NOT TESTED |  |  |  |  |  |  |
| Install | ZIP/NSIS save compatibility | NOT TESTED |  |  |  |  |  |  |
| Basic | Transparent background | NOT TESTED |  |  |  |  |  |  |
| Basic | Frameless rendering | NOT TESTED |  |  |  |  |  |  |
| Basic | Initial position | NOT TESTED |  |  |  |  |  |  |
| Basic | Drag move | NOT TESTED |  |  |  |  |  |  |
| Basic | Position save | NOT TESTED |  |  |  |  |  |  |
| Basic | Off-screen recovery | NOT TESTED |  |  |  |  |  |  |
| Basic | Left click | NOT TESTED |  |  |  |  |  |  |
| Basic | Double click | NOT TESTED |  |  |  |  |  |  |
| Basic | Right-click menu | NOT TESTED |  |  |  |  |  |  |
| Basic | Escape | NOT TESTED |  |  |  |  |  |  |
| Basic | Minimize to tray | NOT TESTED |  |  |  |  |  |  |
| Basic | Restore from tray | NOT TESTED |  |  |  |  |  |  |
| Basic | Full exit | NOT TESTED |  |  |  |  |  |  |
| Basic | Always on top | NOT TESTED |  |  |  |  |  |  |
| Basic | Expanded panel is 240x240 | NOT TESTED |  |  |  |  |  |  |
| Game | Food | NOT TESTED |  |  |  |  |  |  |
| Game | Petting | NOT TESTED |  |  |  |  |  |  |
| Game | Play | NOT TESTED |  |  |  |  |  |  |
| Game | Rest | NOT TESTED |  |  |  |  |  |  |
| Game | Cooldown | NOT TESTED |  |  |  |  |  |  |
| Game | Cannot-play reason | NOT TESTED |  |  |  |  |  |  |
| Game | Daily tasks | NOT TESTED |  |  |  |  |  |  |
| Game | Level up | NOT TESTED |  |  |  |  |  |  |
| Game | Personality display | NOT TESTED |  |  |  |  |  |  |
| Game | Dreams | NOT TESTED |  |  |  |  |  |  |
| Game | Discovery | NOT TESTED |  |  |  |  |  |  |
| Game | Breathing | NOT TESTED |  |  |  |  |  |  |
| Game | Focus | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Normal restart | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Save restore | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Backup recovery | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Corrupted save | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | 12-hour offline cap | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Date change | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Resume from sleep | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Windows restart | NOT TESTED |  |  |  |  |  |  |
| Save/recovery | Restart during focus session | NOT TESTED |  |  |  |  |  |  |
| Display/load | Character outline | NOT TESTED |  |  |  |  |  |  |
| Display/load | Official icon at small size | NOT TESTED |  |  |  |  |  |  |
| Display/load | Tray icon | NOT TESTED |  |  |  |  |  |  |
| Display/load | Bubble clipping | NOT TESTED |  |  |  |  |  |  |
| Display/load | Panel off-screen behavior | NOT TESTED |  |  |  |  |  |  |
| Display/load | CPU usage | NOT TESTED |  |  |  |  |  |  |
| Display/load | Memory usage | NOT TESTED |  |  |  |  |  |  |
| Display/load | Long-running resident use | NOT TESTED |  |  |  |  |  |  |
| Display/load | Defender | NOT TESTED |  |  |  |  |  |  |
| Display/load | SmartScreen | NOT TESTED |  |  |  |  |  |  |
| Display/load | Unsigned disclosure / signed verification | NOT TESTED |  |  |  |  |  |  |

## Repeatable execution

1. Download one successful RC Qualification artifact, verify its commit and package hashes with the commands below, run `windows-rc-qa.ps1`, and retain its JSON as automated evidence only. Do not substitute a local rebuild.
2. Execute each applicable row on both Windows 10 and 11 across 100%, 125%, and 150% scale. Use single and multiple monitors, including a negative-coordinate secondary display. Record exact steps and evidence rather than merely checking a box.
3. Exercise resolution, taskbar position, and primary-display changes before and after restart. For lifecycle tests include sleep/resume, date change, 12-hour offline progression, app and Windows restart.
4. Test clean/alternate/overwrite NSIS installs, uninstall retention, ZIP launch, and cross-package save compatibility. Observe actual SmartScreen and Defender behavior; a script cannot pass those rows.
5. Run the 30-minute measurement and a separate >=2-hour soak. CPU average 0–1% and working set <=100 MB are v0.1 diagnostic goals, not one-sample pass/fail thresholds; review sample history and memory growth.

### Pin and verify the RC artifact

Set these values from the successful workflow run. `QUALIFIED_SHA` must be the full 40-character commit selected by the workflow input, not a branch name or abbreviated SHA.

```powershell
$RcRunId = '<RC_RUN_ID>'
$QualifiedSha = '<QUALIFIED_SHA>'
New-Item -ItemType Directory -Force '.\artifacts\rc' | Out-Null
$RcRoot = (Resolve-Path '.\artifacts\rc').Path

gh run download $RcRunId --dir $RcRoot
$ManifestPath = (Get-ChildItem $RcRoot -Recurse -Filter rc-manifest.json -File -ErrorAction Stop | Select-Object -First 1).FullName
$ReadinessPath = (Get-ChildItem $RcRoot -Recurse -Filter release-readiness.json -File -ErrorAction Stop | Select-Object -First 1).FullName
$InstallerPath = (Get-ChildItem $RcRoot -Recurse -Filter 'KadoMoco-0.1.0-x64.exe' -File -ErrorAction Stop | Select-Object -First 1).FullName
$ZipPath = (Get-ChildItem $RcRoot -Recurse -Filter 'KadoMoco-0.1.0-x64.zip' -File -ErrorAction Stop | Select-Object -First 1).FullName
$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Readiness = Get-Content $ReadinessPath -Raw | ConvertFrom-Json

if ($Manifest.commitSha -ne $QualifiedSha) { throw 'RC manifest commit does not match QUALIFIED_SHA.' }
if ($Readiness.commitSha -ne $QualifiedSha) { throw 'Readiness report commit does not match QUALIFIED_SHA.' }
foreach ($Path in @($InstallerPath, $ZipPath)) {
  $Actual = (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  $Sidecar = ((Get-Content "$Path.sha256" -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  $Entry = $Manifest.artifacts | Where-Object artifactName -eq (Split-Path $Path -Leaf)
  if (!$Entry -or $Actual -ne $Sidecar -or $Actual -ne $Entry.sha256.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $(Split-Path $Path -Leaf)."
  }
}
```

Also compare the workflow run's `headSha` to `$QualifiedSha` with `gh run view $RcRunId --json headSha,conclusion`. Stop if the conclusion is not `success` or any commit/hash comparison fails.

### Run commit- and artifact-pinned performance measurements

Start the extracted ZIP build (`KadoMoco.exe`) before each command, or pass its process ID with `-ProcessId`. Both measurements must reference the same downloaded RC installer, even when the running process came from its matching ZIP. Preserve the JSON and Markdown outputs under the RC evidence directory.

```powershell
$ArtifactSource = "GitHub Actions RC Qualification run $RcRunId"

powershell -ExecutionPolicy Bypass -File scripts/windows-performance-soak.ps1 `
  -DurationMinutes 30 -SampleIntervalSeconds 10 `
  -CommitSha $QualifiedSha -ArtifactPath $InstallerPath -ArtifactSource $ArtifactSource `
  -OperationsPerformed 'idle observation' `
  -OutputDirectory '.\qa-results\v0.1.0-rc.1\performance\30min'

powershell -ExecutionPolicy Bypass -File scripts/windows-performance-soak.ps1 `
  -DurationMinutes 120 -SampleIntervalSeconds 10 `
  -CommitSha $QualifiedSha -ArtifactPath $InstallerPath -ArtifactSource $ArtifactSource `
  -OperationsPerformed 'idle, care actions, panels, tray hide/show, focus session' `
  -IncludedSleepResume `
  -OutputDirectory '.\qa-results\v0.1.0-rc.1\performance\120min'
```

Confirm that each JSON report records the expected `appVersion`, `commitSha`, `artifactFileName`, `artifactSha256`, `artifactSource`, timing and sample counts, CPU and working-set summaries and growth, operations, sleep/resume flag, and `processExitedUnexpectedly`. Missing samples, sustained CPU, memory growth, or an unexpected exit require review and remain `NOT TESTED` or `FAIL` until resolved; the diagnostic goals are not automatic thresholds.
