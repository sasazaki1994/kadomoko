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

  Scenario: Habitat items are shown quietly near the pet
    Given KadoMoco has unlocked habitat items
    When the app is running normally
    Then up to two small habitat items are shown near the pet
    And they do not cover the care menu or status panel

  Scenario: Habitat items unlock through progression
    Given the pet reaches a new level or affection threshold
    When habitat unlocks are evaluated
    Then newly available habitat items are added without removing existing save data

  Scenario: Habitat items influence random events
    Given a soft cloth is placed in the habitat
    And the pet is sleepy
    When a random event is rolled
    Then a resting or curling event is weighted higher

  Scenario: Memory flags are created on day rollover
    Given the pet played often yesterday
    When the app crosses into a new local date
    Then a played_yesterday memory flag is stored
    And expired memory flags are removed

  Scenario: Memory affects future behavior without blaming the user
    Given the pet has memory flags from previous days
    When spontaneous events or bubbles are selected
    Then matching event tendencies are weighted slightly higher
    And no blaming message is shown
