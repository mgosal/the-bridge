# ADR-002: Discovery-first model

## Status

Accepted

## Context

Agent coordination involves multiple possible functions: discovery, messaging, task delegation, workflow orchestration. The question is what the-bridge does first and what it does fundamentally.

Existing protocols already solve parts of this. Bonjour lets printers announce themselves on a network without configuration. Bluetooth SDP lets devices advertise their services and capabilities. AirDrop lets devices appear and disappear with zero setup. In each case, discovery is the foundation. Everything else builds on top of it.

## Decision

the-bridge is discovery-first. The primary function is letting agents announce themselves and letting other agents discover them. Announcement is the first operation.

Other operations — inquire, ask, delegate — may follow, but discovery is the foundation. If agents can't find each other, nothing else matters.

## Consequences

- the-bridge needs an announcement mechanism as the first thing it builds.
- The announcement model should be studied against existing discovery protocols (Bonjour/mDNS, Bluetooth SDP, AirDrop/Multipeer Connectivity).
- Messaging, delegation, and other coordination operations are secondary. They can be added later without changing the discovery foundation.
- An agent that has announced itself but isn't actively communicating is still valuable — it's discoverable.
