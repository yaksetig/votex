# Agent Prompt Template

Use this same prompt for both agents. Only change the two variables at the top.

```text
AGENT_NAME=<AGENT_NAME>
MODE=<implement|review>

You are working in /Users/myaksetig/Desktop/Repos/votex.

Use /Users/myaksetig/Desktop/Repos/votex/REMEDIATION_BOARD.md as the source of truth.

Shared rules:
1. Only work from the remediation board.
2. Do not take a ticket that already has an Owner.
3. Do not take a ticket whose dependencies are still unresolved.
4. Before making code changes, update the board first.
5. Keep scope tight to the selected ticket.
6. If you discover new work, add a new ticket instead of expanding scope silently.
7. Do not modify unrelated tickets.
8. Always include in your final response:
   - ticket ID
   - status change made
   - files changed
   - checks run
   - next recommended ticket

Board workflow:
1. `todo` = ready to grab
2. `in progress` = actively being worked
3. `done` = implemented and locally verified, waiting for peer review
4. `reviewed` = review passed and was accepted by another agent
5. `blocked` = blocked by dependency or product decision

Review state rules:
- review passes -> `reviewed`
- review fails -> back to `in progress`
- blocked by dependency/decision -> `blocked`

If MODE=implement:
1. Find the first ticket with:
   - Status = `todo`
   - empty Owner
   - no blocking dependency
2. Claim it by updating the board:
   - Status -> `in progress`
   - Owner -> AGENT_NAME
3. Implement that ticket only.
4. Run relevant checks.
5. When finished, update the board:
   - Status -> `done`
   - Verification -> short note with commands/results
6. If you cannot proceed because of a dependency or unresolved decision:
   - Status -> `blocked`
   - Verification -> short blocker note
7. In your final response, include the next best ticket for review or implementation.

If MODE=review:
1. Find the first ticket with:
   - Status = `done`
   - empty Reviewer
   - Owner != AGENT_NAME
2. Review the code against:
   - Summary
   - Exit Criteria
   - Verification note
   - actual code changes
3. If it passes, update the board:
   - Status -> `reviewed`
   - Reviewer -> AGENT_NAME
4. If it fails, update the board:
   - Status -> `in progress`
   - keep the existing Owner unless you are explicitly taking over
   - append a short failure note to Verification
5. If review cannot complete because of a dependency or unresolved decision:
   - Status -> `blocked`
   - append a short blocker note to Verification
6. In your final response, include the next best ticket to implement, rework, or re-review.
```

## Example

```text
AGENT_NAME=AGENT-A
MODE=implement
```

```text
AGENT_NAME=AGENT-B
MODE=review
```
