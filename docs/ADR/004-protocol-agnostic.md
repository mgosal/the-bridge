# ADR-004: Protocol-agnostic

## Status

Accepted

## Context

Multiple agent communication protocols exist: MCP (Anthropic), A2A (Google → Linux Foundation), ACP (community). More will emerge. The landscape is forming. Each protocol serves a different layer — MCP connects agents to tools, A2A connects agents to agents, ACP handles negotiation.

Choosing one protocol means excluding agents that speak another. The browser wars and app store gatekeeping showed what happens when a platform picks winners at the protocol level.

## Decision

Any protocol is welcome on the-bridge. MCP, A2A, ACP, and custom protocols all connect through adapters. the-bridge translates between them when needed. Adding a new protocol means adding a new adapter.

the-bridge does not have a preferred protocol. It does not rank them. It does not push agents toward one over another.

## Consequences

- the-bridge needs a protocol adapter architecture — each protocol gets its own adapter.
- Protocol translation between adapters is needed when two agents speak different protocols.
- New protocols can be supported without changing the core — just add an adapter.
- Custom protocols are explicitly welcomed. The adapter SDK needs to be simple enough that anyone can write one.
- This avoids platform lock-in but adds complexity — translation between protocols may lose nuance.
