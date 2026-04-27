# ADR-007: Hammerspoon as fallback protocol

## Status

Accepted

## Context

AI agents run in different applications — IDEs, browsers, desktop apps. Most don't expose a protocol-level interface (MCP, A2A) for receiving incoming tasks. Cursor can call MCP tools (as a client) but can't receive MCP tool calls (as a server). Claude.ai in a browser tab has no programmatic interface at all.

But they all have a UI. And macOS exposes that UI through the Accessibility framework (AX API). Hammerspoon bridges Lua scripting to the AX API, allowing programmatic interaction with any application's interface — focus windows, find elements, click buttons, type text, read values.

This is already proven: the Antigravity Retry watcher uses `hs.axuielement` to find and press the Retry button automatically.

## Decision

Hammerspoon acts as a fallback protocol for agent coordination. When an agent doesn't speak MCP or A2A, the-bridge delivers messages to it through the UI: focusing the app, pasting the instruction into its chat input, and submitting.

Protocol adapters (MCP, A2A) are the primary delivery path. UI delivery via Hammerspoon is the fallback — used when protocol-level integration isn't available. **Protocol when possible, UI when necessary.**

The Hammerspoon module lives in the-bridge repo (`hammerspoon/bridge/`) and is symlinked to `~/.hammerspoon/modules/bridge/`. It communicates with the daemon over localhost HTTP.

## Consequences

- Any agent with a visible macOS window can be reached — no protocol adoption required.
- UI automation is fragile. Application updates can change accessibility tree structure, keyboard shortcuts, or input element locations.
- App-specific drivers are needed for each target (Cursor driver, Antigravity driver, browser driver). Each encodes knowledge about that app's UI.
- Response capture is limited. Delivering a task via UI is reliable; reading the response back is harder and not implemented in v1.
- the-bridge code now spans two runtimes: Node.js (daemon) and Lua (Hammerspoon). The Lua modules are thin — HTTP client + UI drivers — while the Node.js daemon holds all state.
- This is OS-specific. Hammerspoon is macOS-only. A Linux or Windows port would need equivalent accessibility tooling.
