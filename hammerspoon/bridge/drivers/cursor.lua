-- the-bridge: Cursor UI driver
-- Delivers tasks to Cursor by focusing the app, opening the AI chat pane,
-- pasting the instruction, and submitting.

local cursor = {}

cursor.capabilities = {
    "code-generation",
    "file-edit",
    "terminal",
    "code-review",
}

--- Check if Cursor is running.
function cursor.isRunning()
    return hs.application.get("Cursor") ~= nil
end

--- Get the workspace paths Cursor has open (if detectable from window titles).
function cursor.resources()
    local app = hs.application.get("Cursor")
    if not app then return {} end

    local resources = {}
    for _, w in ipairs(app:allWindows()) do
        local title = w:title()
        -- Cursor window titles typically show the project name or file path
        if title and title ~= "" then
            table.insert(resources, "window:" .. title)
        end
    end
    return resources
end

--- Deliver a task to Cursor via UI automation.
--- @param message table The message from the bridge daemon
function cursor.deliverTask(message)
    local app = hs.application.get("Cursor")
    if not app then
        error("Cursor is not running")
    end

    local instruction = message.payload and message.payload.instruction
    if not instruction then
        error("No instruction in message payload")
    end

    -- Step 1: Focus Cursor
    app:activate()
    hs.timer.usleep(500000) -- 500ms for window to come to front

    -- Step 2: Open the AI chat pane (Cmd+L opens inline chat in Cursor)
    hs.eventtap.keyStroke({"cmd"}, "l")
    hs.timer.usleep(800000) -- 800ms for chat pane to open

    -- Step 3: Load instruction into clipboard and paste
    local previousClipboard = hs.pasteboard.getContents()
    hs.pasteboard.setContents(instruction)
    hs.timer.usleep(100000) -- 100ms

    hs.eventtap.keyStroke({"cmd"}, "v")
    hs.timer.usleep(300000) -- 300ms for paste

    -- Step 4: Submit
    hs.eventtap.keyStroke({}, "return")

    -- Step 5: Restore previous clipboard (polite)
    hs.timer.doAfter(2, function()
        if previousClipboard then
            hs.pasteboard.setContents(previousClipboard)
        end
    end)

    hs.printf("[bridge:cursor] delivered task: %s", message.id or "unknown")
end

return cursor
