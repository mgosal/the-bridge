-- the-bridge: Browser UI driver
-- Generic driver for agents that live in browser tabs (Claude.ai, ChatGPT, Gemini web).
-- Focuses the browser, finds the tab, and delivers the instruction.

local browser = {}

browser.capabilities = {
    "conversation",
    "web-search",
    "analysis",
}

-- Known agent tab titles (partial match)
local TAB_PATTERNS = {
    claude = "Claude",
    chatgpt = "ChatGPT",
    gemini = "Gemini",
}

--- Detect which browsers are available.
local function getBrowser()
    -- Prefer Arc, then Chrome, then Safari
    local browsers = { "Arc", "Google Chrome", "Safari" }
    for _, name in ipairs(browsers) do
        local app = hs.application.get(name)
        if app then return app, name end
    end
    return nil, nil
end

--- Check if any browser is running.
function browser.isRunning()
    local app = getBrowser()
    return app ~= nil
end

--- Get resources (open tabs with known AI agent patterns).
function browser.resources()
    -- Tab enumeration via AX is expensive and unreliable across browsers.
    -- Return a generic indicator instead.
    local app, name = getBrowser()
    if not app then return {} end
    return { "browser:" .. name }
end

--- Deliver a task to a browser-based agent.
--- This is a basic implementation: focus browser, use clipboard + paste.
--- Tab-switching to the right AI agent tab is fragile and browser-dependent.
--- @param message table The message from the bridge daemon
function browser.deliverTask(message)
    local app, browserName = getBrowser()
    if not app then
        error("No browser is running")
    end

    local instruction = message.payload and message.payload.instruction
    if not instruction then
        error("No instruction in message payload")
    end

    -- Step 1: Focus browser
    app:activate()
    hs.timer.usleep(500000)

    -- Step 2: Paste instruction
    -- Assumes the correct tab and input field are already focused.
    -- A more sophisticated version would use AppleScript/JXA to switch tabs.
    local previousClipboard = hs.pasteboard.getContents()
    hs.pasteboard.setContents(instruction)
    hs.timer.usleep(100000)

    hs.eventtap.keyStroke({"cmd"}, "v")
    hs.timer.usleep(300000)

    -- Step 3: Submit (Enter)
    hs.eventtap.keyStroke({}, "return")

    -- Step 4: Restore clipboard
    hs.timer.doAfter(2, function()
        if previousClipboard then
            hs.pasteboard.setContents(previousClipboard)
        end
    end)

    hs.printf("[bridge:browser] delivered task via %s: %s", browserName, message.id or "unknown")
end

return browser
