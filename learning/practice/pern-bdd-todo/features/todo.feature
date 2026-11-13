Feature: As a user, I want to manage my todo list so that I can keep track of my tasks.

  Scenario: Add a task
    Given my todo list is empty
    When I add "Buy milk"
    Then I see "Buy milk" as incomplete
    When I reload the page
    Then I see "Buy milk" as incomplete
    
  Scenario: Reject blank task
    Given my todo list is empty
    When I add a blank task
    Then I see "Enter a task"