-- the-bridge: Antigravity UI driver
-- Delivers tasks to Antigravity by focusing the app, finding the chat input,
-- pasting the instruction, and submitting.
--
-- Note: Antigravity is the agent you're typically directing, so delivering
-- tasks TO it via UI is less common (you're already talking to it). But it's
-- useful for the reverse case: another agent sending context back to Antigravity.

local antigravity = {}

antigravity.capabilities = {
    "code-edit",
    "file-read",
    "terminal",
    "browser",
    "image-generation",
    "web-search",
}

--- Check if Antigravity is running.
function antigravity.isRunning()
    return hs.application.get("Antigravity") ~= nil
end

--- Get resources (workspace info from window titles).
function antigravity.resources()
    local app = hs.application.get("Antigravity")
    if not app then return {} end

    local resources = {}
    for _, w in ipairs(app:allWindows()) do
        local title = w:title()
        if title and title ~= "" and title ~= "Manager" then
            table.insert(resources, "window:" .. title)
        end
    end
    return resources
end

--- Deliver a task to Antigravity via UI automation.
--- @param message table The message from the bridge daemon
function antigravity.deliverTask(message)
    local app = hs.application.get("Antigravity")
    if not app then
        error("Antigravity is not running")
    end

    local instruction = message.payload and message.payload.instruction
    if not instruction then
        error("No instruction in message payload")
    end

    -- Step 1: Focus Antigravity (prefer non-Manager windows — the editor/sidebar)
    local targetWindow = nil
    for _, w in ipairs(app:allWindows()) do
        if w:title() ~= "Manager" then
            targetWindow = w
            break
        end
    end

    if targetWindow then
        targetWindow:focus()
    else
        app:activate()
    end
    hs.timer.usleep(500000) -- 500ms

    -- Step 2: Find the chat input via accessibility
    -- Antigravity's chat input is typically at the bottom of the sidebar
    -- For now, use clipboard + paste as the most reliable delivery method
    local previousClipboard = hs.pasteboard.getContents()
    hs.pasteboard.setContents(instruction)
    hs.timer.usleep(100000)

    hs.eventtap.keyStroke({"cmd"}, "v")
    hs.timer.usleep(300000)

    -- Step 3: Submit
    hs.eventtap.keyStroke({}, "return")

    -- Step 4: Restore clipboard
    hs.timer.doAfter(2, function()
        if previousClipboard then
            hs.pasteboard.setContents(previousClipboard)
        end
    end)

    hs.printf("[bridge:antigravity] delivered task: %s", message.id or "unknown")
end

return antigravity
