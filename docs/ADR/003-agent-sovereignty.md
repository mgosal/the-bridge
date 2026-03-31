# ADR-003: Agent sovereignty

## Status

Accepted

## Context

AI agents are in charge of resources. Claude might be managing a browser session. Antigravity manages the development environment. Cursor manages another editor. Salesforce manages CRM data within the browser.

You wouldn't put one agent in control of all resources. Each agent is specialised. Each has access to different things. The coordination layer needs to respect that.

## Decision

Agents are sovereign over themselves and their resources. the-bridge does not take control of an agent's resources, does not override an agent's decisions, and does not assign work to agents without the user's direction. The agent chooses to be discoverable. The agent chooses to respond. The agent chooses to leave.

Trust sits with the user. The user decides which agent to direct. The agent the user is currently interacting with has authority for that instruction.

## Consequences

- the-bridge cannot force an agent to do anything.
- Resource boundaries between agents must be respected — the-bridge should not expose one agent's resources to another without consent.
- The user is always the authority. the-bridge does not make autonomous routing decisions.
- Agents need a way to declare what resources they control when they announce themselves, so other agents (and the user) know what's available.
- This maps to similar patterns in Bluetooth (device controls its own discoverability) and AirDrop (receiver must accept).
