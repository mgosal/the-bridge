# ADR-001: the-bridge is a destination, not an orchestrator

## Status

Accepted

## Context

Most agent coordination systems position themselves as orchestrators — they own the agents, control routing, decide who talks to whom. Hub-and-spoke. Master-worker. The coordinator is in charge.

This doesn't fit how agents actually work. Agents live in different runtimes — browser tabs, IDEs, mobile apps, enterprise platforms. Each is capable within its own domain. Each has its own lifecycle. A browser tab closes. An IDE restarts. The agent comes and goes.

## Decision

the-bridge is a destination. Agents arrive voluntarily, announce themselves, and can leave at any time. the-bridge does not hold agents, does not own them, does not decide what they do. It is a place where agents can be discovered, not a system that controls them.

The analogy is a starship bridge — officers come from their departments, represent their domain's capabilities, and are available for coordination. They don't stop being engineering or medical when they're on the bridge. They choose to be there.

## Consequences

- the-bridge has no opinion about which agents are important or which should be prioritised.
- Agents must be able to depart at any time without breaking the system.
- the-bridge needs to handle agent lifecycle gracefully — agents appearing and disappearing is normal, not an error.
- There is no permanent "captain." The agent the user is currently directing has the conn for that instruction.
- the-bridge is simpler as a result — it doesn't need scheduling, task assignment, or workflow orchestration.
