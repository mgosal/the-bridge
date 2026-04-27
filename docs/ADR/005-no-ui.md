# ADR-005: the-bridge has no user interface

## Status

Accepted

## Context

the-bridge runs as a daemon. The user interacts with agents — in an IDE, in a browser, on mobile. Each agent already has its own interface. Adding another interface on top of that adds noise to an already messy desktop.

## Decision

the-bridge has no UI. The agent the user is currently working with is the interface. If the user is in Antigravity, Antigravity surfaces discovery results, messages, and approval requests from the-bridge. If the user is in Claude, Claude does it.

the-bridge is a background process. The user never interacts with it directly.

## Consequences

- All user-facing information (agent discovery, messages, approvals) must flow through whichever agent the user is talking to.
- the-bridge needs to expose everything through its protocol adapters — there's no fallback UI if an agent doesn't surface something.
- Debugging the-bridge itself may require logs or a CLI, but not a graphical interface.
- This keeps the-bridge simple and avoids competing with the agents it coordinates.

## Note

The viewscreen (ADR-009) is not a UI in this sense. It is observability — a visual log of who is on the bridge. The bridge remains invisible to use. The viewscreen lets a visual species see what's happening without changing how agents interact.
