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

1. Record commit and artifact hashes, run `windows-rc-qa.ps1`, and retain its JSON as automated evidence only.
2. Execute each applicable row on both Windows 10 and 11 across 100%, 125%, and 150% scale. Use single and multiple monitors, including a negative-coordinate secondary display. Record exact steps and evidence rather than merely checking a box.
3. Exercise resolution, taskbar position, and primary-display changes before and after restart. For lifecycle tests include sleep/resume, date change, 12-hour offline progression, app and Windows restart.
4. Test clean/alternate/overwrite NSIS installs, uninstall retention, ZIP launch, and cross-package save compatibility. Observe actual SmartScreen and Defender behavior; a script cannot pass those rows.
5. Run the 30-minute measurement and a separate >=2-hour soak. CPU average 0–1% and working set <=100 MB are v0.1 diagnostic goals, not one-sample pass/fail thresholds; review sample history and memory growth.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-performance-soak.ps1 -DurationMinutes 30 -SampleIntervalSeconds 10 -OutputDirectory '.\qa-results'
powershell -ExecutionPolicy Bypass -File scripts/windows-performance-soak.ps1 -DurationMinutes 120 -SampleIntervalSeconds 10 -OutputDirectory '.\qa-results'
```
