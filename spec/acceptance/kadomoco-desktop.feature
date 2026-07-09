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

  Scenario: Long idle periods do not delete or permanently remove the pet
    Given the app has been idle for longer than the maximum offline progression window
    When the app resumes or restarts
    Then offline progression is applied up to the configured limit
    And the pet does not die
    And the pet does not permanently leave
    And saved pet data is not lost
