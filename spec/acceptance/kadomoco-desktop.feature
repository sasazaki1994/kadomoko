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
