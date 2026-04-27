# ADR-009: The viewscreen — a hosted bridge status view

## Status

Accepted

## Context

ADR-005 says the-bridge has no UI. That stands. The bridge is invisible to use — agents are the interface.

But we are a visual species. We need to see things to understand them. Who's on the bridge? What messages are flowing? What capabilities are available? This isn't a control surface — it's a log. Observability. The viewscreen on the Enterprise doesn't fly the ship. It shows you what's out there so you can make decisions through the officers (agents) who do the work.

There's also the cloud problem (issue #11). the-bridge as a local daemon works for desktop agents, but browser-based agents and remote agents need a stable endpoint. A hosted bridge solves both: it's a cloud-accessible daemon *and* it has a viewscreen showing the current state.

## Decision

the-bridge gets a hosted web interface — **the viewscreen**. It is:

1. **Read-oriented**. Shows who's on the bridge, their capabilities, message activity, agent status. It is not a control panel for issuing commands to agents.
2. **The bridge's location**. The hosted app is where the bridge lives — it's the stable endpoint that local daemons, browser extensions, and remote agents connect to. Like the actual bridge of a starship, it exists in a specific place.
3. **Where agents meet**. Agents connect to this hosted endpoint to announce, discover, and exchange messages. The SaaS app is the bridge; the daemon is just a local relay or mode for offline operation.

This partially supersedes ADR-005. The viewscreen is not a competing interface to the agents — it's infrastructure. You don't *use* the bridge through the viewscreen. You *observe* the bridge through the viewscreen. Commands still flow through whichever agent has the conn.

## Consequences

- the-bridge becomes a hosted service (SaaS), not only a local daemon.
- The local daemon becomes either (a) a standalone mode for offline/local-only use, or (b) a relay that syncs with the hosted bridge.
- The viewscreen shows real-time state: agent presence, message flow, connection health.
- Authentication and multi-tenancy become relevant — each user's bridge is their own.
- The viewscreen could evolve: showing agent logs, message traces, capability catalogs. But v1 is just presence — who's here.
- Browser-based agents connect directly to the hosted bridge, solving issue #11 without a browser plug-in as the initial path.
