-- the-bridge: Hammerspoon bridge module
-- Fallback protocol adapter — drives agents through macOS UI when protocol-level
-- integration isn't available.
--
-- Architecture:
--   daemon (Node.js on :7777) ←→ daemon-client.lua (HTTP) ←→ drivers (AX/pasteboard/eventtap)
--
-- This module auto-registers running agents with the daemon and polls for
-- messages addressed to UI-managed agents.

local bridge = {}

local daemonClient = require("modules.bridge.daemon-client")
local drivers = {
    cursor = require("modules.bridge.drivers.cursor"),
    antigravity = require("modules.bridge.drivers.antigravity"),
    browser = require("modules.bridge.drivers.browser"),
}

bridge.daemon = daemonClient
bridge.drivers = drivers

-- Poll timer
local pollTimer = nil
local POLL_INTERVAL = 3 -- seconds

-- ── Agent auto-registration ──────────────────────────────────────
-- Detect running apps and announce them to the daemon.
-- Re-checks periodically in case apps launch or quit.

local function registerRunningAgents()
    if not daemonClient.isAvailable() then return end

    for name, driver in pairs(drivers) do
        if driver.isRunning() then
            daemonClient.announce({
                name = name,
                protocol = "ui",
                capabilities = driver.capabilities or {},
                resources = driver.resources and driver.resources() or {},
                endpoint = "ui://" .. name,
            })
        end
    end
end

-- ── Message delivery ─────────────────────────────────────────────
-- Poll the daemon for messages addressed to UI-managed agents.
-- When a message arrives, dispatch to the appropriate driver.

local function pollAndDeliver()
    if not daemonClient.isAvailable() then return end

    for name, driver in pairs(drivers) do
        if driver.isRunning() then
            local messages = daemonClient.pollInbox(name)
            if messages and #messages > 0 then
                for _, msg in ipairs(messages) do
                    hs.printf("[bridge] received message for %s: %s", name, msg.id)

                    -- Mark as delivered
                    daemonClient.markDelivered(msg.id)

                    -- Dispatch to driver
                    local ok, err = pcall(function()
                        driver.deliverTask(msg)
                    end)

                    if ok then
                        hs.printf("[bridge] delivered to %s: %s", name, msg.id)
                    else
                        hs.printf("[bridge] ERROR delivering to %s: %s", name, tostring(err))
                    end
                end
            end
        end
    end
end

-- ── Lifecycle ────────────────────────────────────────────────────

function bridge.start()
    hs.printf("[bridge] starting...")

    -- Initial registration
    registerRunningAgents()

    -- Start polling for messages
    pollTimer = hs.timer.new(POLL_INTERVAL, function()
        pollAndDeliver()
    end)
    pollTimer:start()

    -- Re-register agents every 30s (also serves as heartbeat)
    bridge._registrationTimer = hs.timer.new(30, registerRunningAgents)
    bridge._registrationTimer:start()

    hs.printf("[bridge] started — polling every %ds", POLL_INTERVAL)
end

function bridge.stop()
    if pollTimer then pollTimer:stop() end
    if bridge._registrationTimer then bridge._registrationTimer:stop() end
    hs.printf("[bridge] stopped")
end

-- Auto-start on load
bridge.start()

return bridge
