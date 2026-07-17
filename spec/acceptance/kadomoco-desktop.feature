Feature: KadoMoco desktop pet
  KadoMoco v0.1 should launch locally, preserve pet data, and keep the desktop pet safe even after long idle periods.

  Scenario: Launch shows a transparent frameless window
    Given dependencies are installed
    When the developer runs "npm run dev"
    Then a transparent frameless Electron window is shown
    And the pet is visible without requiring a browser tab

  Scenario: Care actions can be run from the right-click menu
    Given the KadoMoco window is visible
    When the user opens the right-click menu on the pet
    And the user selects a care action
    Then the related vital values or current action are updated
    And the updated pet state is saved

  Scenario: Status panel shows progression and daily information
    Given the pet menu is open
    When the user opens the status panel
    Then the level, EXP, vitals, daily tasks, and personality are displayed

  Scenario: Daily task progress is visible
    Given the status panel is open
    When the pet has spent time together today
    Then time-based daily tasks show quiet progress text
    And completed daily tasks remain shown as checked

  Scenario: Completing a daily task shows a quiet bubble
    Given a daily task is incomplete
    When the user completes that daily task
    Then a short quiet bubble is shown
    And the task is marked completed

  Scenario: Close hides the window instead of quitting
    Given the Electron window is visible
    When the user closes the window without selecting quit
    Then the app remains running in the tray
    And the tray menu can show the window again

  Scenario: Restart restores pet state and window settings
    Given the pet state, window position, and always-on-top setting have been saved
    When the app is restarted
    Then the pet state is restored
    And the window position is restored when it is still visible on a display
    And the always-on-top setting is restored

  Scenario: Corrupted primary save recovers from backup
    Given the primary save data is corrupted
    And the backup save data is valid
    When the app is restarted
    Then the pet state is restored from the backup
    And settings, window position, and last launch time remain recoverable
    And the app does not crash

  Scenario: Temporary resting is not persisted as a long-running action
    Given the pet has sleepiness below 20
    When the user selects "休ませる"
    Then the pet briefly shows the resting animation
    And the saved current action remains "none"

  Scenario: Blocked care actions provide quiet feedback
    Given a care action is on cooldown
    When the user selects the same care action again
    Then a short quiet bubble is shown
    And the pet vitals do not change from the blocked action
    When the pet is too sleepy or too hungry to play
    Then "遊ぶ" is visibly unavailable or shows a short reason bubble

  Scenario: Long idle periods do not delete or permanently remove the pet
    Given the app has been idle for longer than the maximum offline progression window
    When the app resumes or restarts
    Then offline progression is applied up to the configured limit
    And the pet does not die
    And the pet does not permanently leave
    And saved pet data is not lost

  Scenario: Windows distribution can be packaged
    Given dependencies are installed
    When the developer runs "npm run package:win"
    Then a Windows desktop application package is written under "release/"
    And the pet sprite sheet is included in the production build

  Scenario: Life rhythm changes quiet behavior by time of day
    Given the app is running
    When the local time is late night
    Then sleepy or resting events become more likely
    And no disruptive notification is shown

  Scenario: Resume from sleep shows a gentle reaction
    Given the PC was sleeping
    When the PC resumes
    Then KadoMoco catches up offline progress
    And a short non-blaming bubble may be shown

  Scenario: Personality affects random event tendencies
    Given KadoMoco has an energetic personality
    When a random event is rolled
    Then playful or hopping events are weighted higher than calm events

  Scenario: Status panel shows today's observation summary
    Given the status panel is open
    When the pet has current vitals and care stats
    Then a short daily summary is shown
    And the summary does not contain blaming language

  Scenario: Journal entry is created on day rollover
    Given the app crosses into a new local date
    When daily tasks are rerolled
    Then a compact journal entry for the previous day is stored
    And at most 30 journal entries are retained

  Scenario: A contextual care action appears when the pet needs it
    Given the pet is very sleepy
    When the user opens the right-click menu
    Then one contextual action "そっとする" is shown
    And the default four care actions are still available

  Scenario: Contextual care respects the current state
    Given the pet is sleeping
    When the user selects "そっとする"
    Then the pet is not woken up
    And a quiet reaction may be shown

  Scenario: Observation mode hides raw numbers
    Given the status panel is open
    When the display mode is set to observation
    Then vitals are described with short text
    And raw numeric vital values are not shown

  Scenario: Quiet settings reduce ambient interruptions
    Given bubble frequency is set to quiet
    When ambient events are processed
    Then spontaneous bubbles are less frequent
    And direct user action feedback is still available

  Scenario: Settings persist after restart
    Given display and frequency settings are changed
    When the app is restarted
    Then the settings are restored

  Scenario: A quiet episode is recorded from the day
    Given the pet spent meaningful time with the user
    When the local date rolls over
    Then a short non-blaming episode may be stored
    And duplicate episodes for the same date are not stored

  Scenario: Recent episodes can be viewed
    Given the pet has stored episode entries
    When the user opens the record panel
    Then recent episodes are shown in short text
    And the normal pet window remains unobtrusive

  Scenario: Weekly reflection summarizes without judging
    Given journal entries exist for a week
    When a weekly reflection is created
    Then it summarizes the week in a short neutral sentence
    And it does not rank or blame the user

  Scenario: Relationship note describes the current bond
    Given the pet has current affection, personality, and memory
    When the status or record panel is opened
    Then a short relationship note is displayed
    And it is not shown as a score or rank

  Scenario: Episode history is safely migrated
    Given an older save file exists
    When the app loads the save
    Then episode and weekly reflection fields are added safely
    And existing pet data is preserved

  Scenario: A quiet discovery appears near the pet
    Given KadoMoco is calm and curious
    When discovery rolling succeeds
    Then a small unobtrusive discovery hint is shown
    And the normal pet interactions remain available

  Scenario: Inspecting a discovery creates a small moment
    Given an active discovery exists
    When the user selects "見にいく"
    Then KadoMoco shows a short curious reaction
    And the discovery is resolved
    And a short non-collecting episode may be recorded

  Scenario: Discoveries expire without penalty
    Given an active discovery exists
    When the discovery expires
    Then it disappears quietly
    And no negative message is shown

  Scenario: Discovery state is safely migrated
    Given an older save file exists
    When the app loads the save
    Then discovery state is initialized safely
    And existing pet data is preserved

  Scenario: Quiet settings reduce discovery interruption
    Given ambient frequency is quiet
    When discovery rolling is evaluated
    Then discoveries are less likely to appear
    And direct user actions still work

  Scenario: A secret signal can trigger a small reaction
    Given the user performs a short matching input pattern
    When the signal is detected
    Then KadoMoco shows a brief quiet reaction
    And no success or failure score is shown

  Scenario: Secret signals are rate limited
    Given a secret signal has just triggered
    When the same input pattern is repeated immediately
    Then the same signal does not trigger again during cooldown

  Scenario: A tiny play can start and end quietly
    Given ambient activity is allowed
    When a tiny play starts
    Then a small unobtrusive visual effect is shown
    And it ends automatically within a short time

  Scenario: Tiny play does not interrupt work
    Given the menu or status panel is open
    When tiny play would be visible
    Then the tiny play is hidden or paused
    And normal menu interaction remains available

  Scenario: Secret signal and tiny play data migrate safely
    Given an older save file exists
    When the app loads the save
    Then signal and tiny play state are initialized safely
    And existing pet data is preserved

  Scenario: A dream forms quietly while the pet sleeps
    Given the pet is sleeping
    When enough quiet time passes
    Then a dream may start forming without waking the pet
    And no notification interrupts the user

  Scenario: Waking surfaces a dream fragment to listen to
    Given a dream formed during sleep
    When the pet wakes up
    Then a small dream cue appears near the pet
    And the context action "夢のはなしを聞く" becomes available

  Scenario: Listening to a dream stores a small memory
    Given a dream fragment is pending
    When the user selects "夢のはなしを聞く"
    Then a short quiet bubble is shown
    And the fragment is stored in the dream record as listened
    And a short non-judging episode may be recorded

  Scenario: Unheard dreams fade without penalty
    Given a dream fragment is pending
    When the fragment expires before being listened to
    Then it fades quietly into the dream record
    And no negative message or penalty is shown

  Scenario: Dreams are rare and rate limited
    Given dreams already happened twice today
    When the pet sleeps again
    Then no further dream forms that day

  Scenario: Dream state is safely migrated
    Given an older save file exists
    When the app loads the save
    Then dream state is initialized safely
    And existing pet data is preserved

  Scenario: A quiet focus session can be started
    Given the user opens the right-click menu
    When the user starts a 10-minute or 25-minute focus session
    Then a small remaining-time cue is shown near KadoMoco
    And normal pet interactions remain available

  Scenario: A focus session completes gently
    Given a focus session is active
    When its end time is reached
    Then KadoMoco shows a short quiet reaction
    And the session is counted once
    And no disruptive notification is shown

  Scenario: Ending focus early has no penalty
    Given a focus session is active
    When the user ends it before its end time
    Then the session closes without a reward
    And no failure or blaming message is shown

  Scenario: Focus sessions survive restart safely
    Given a focus session was active when the app closed
    When the app restarts after its end time
    Then the session completes exactly once
    And older saves receive an empty focus session state without losing pet data

  Scenario: Production sprite sheet is generated from the magenta source image
    Given the KadoMoco magenta source image is stored as a text-safe Base64 asset
    When the developer runs "node scripts/prepare-production-sprite-sheet.mjs"
    Then "src/assets/pet/pixel/kadomoco_sheet.png" is a 256 by 512 RGBA PNG
    And the sprite sheet contains 4 columns and 8 rows of non-empty 64 by 64 frames
    And the transparent corners and cells do not show the magenta source background
    And preview artifacts are generated for visual animation review

  Scenario: Corrupted primary and backup saves fall back safely
    Given the primary save data is corrupted
    And the backup save data is corrupted
    When the app is restarted
    Then a fresh initial pet state is loaded
    And the app does not crash
    And the corrupted files are kept aside when possible

  Scenario: Electron E2E uses a Linux-only sandbox workaround
    Given KADOMOCO_E2E is set to "1"
    And the operating system is Linux
    When Electron E2E launches the production app
    Then the app is launched with an E2E-only sandbox workaround
    And normal production launches keep their default sandbox behavior
    And early Electron exits report stderr and the exit status without waiting for the full scenario timeout

Feature: v0.1.0 RC qualification kit
  Release managers need reproducible Windows RC artifacts without publishing a GitHub Release.

  Scenario: Manual RC workflow produces qualification artifacts without release side effects
    Given a maintainer starts the RC Qualification workflow for a branch, commit, or tag
    When the workflow completes successfully
    Then it uploads Windows EXE and ZIP artifacts
    And it uploads SHA-256 checksum files
    And it uploads an rc-manifest.json with per-artifact hashes and sizes
    And it uploads a Windows QA result template
    And it does not create a tag, GitHub Release, issue, or pull request

  Scenario: Windows RC QA helper records warnings without touching user saves
    Given a tester has extracted an RC artifact directory on Windows
    When the tester runs scripts/windows-rc-qa.ps1 without administrator privileges
    Then the script verifies artifact presence, versions, hashes, ZIP contents, and signature status
    And NotSigned is recorded as a warning for v0.1.0
    And the script writes a UTF-8 JSON report
    And the script does not uninstall the app, delete files, or intentionally modify existing save data

  Scenario: Proprietary project licensing is required for release artifacts
    Given KadoMoco is proprietary and All Rights Reserved
    And package metadata declares private true and UNLICENSED
    When the license checker runs in require mode
    Then it validates the owner, year, project documents, and package metadata
    And Windows packages contain LICENSE and THIRD_PARTY_NOTICES.md in resources
    And third-party licenses are not represented as licenses for KadoMoco itself

  Scenario: Asset preparation restores a damaged production sprite deterministically
    Given the production sprite is missing or damaged
    And the canonical Base64 sprite source is valid
    When the developer runs "npm run prepare:assets"
    Then the production sprite is regenerated from the canonical source
    And the sprite and generated application icons pass binary validation
    And the regenerated production sprite is ignored rather than committed as a binary patch

  Scenario: A damaged canonical sprite source stops asset preparation
    Given the canonical Base64 sprite source is damaged
    When the developer runs "npm run prepare:sheet"
    Then asset preparation fails without using the existing production sprite as a fallback
