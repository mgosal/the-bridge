-- the-bridge: Daemon HTTP client
-- Communicates with the Node.js daemon running on localhost:7777.
-- All operations are synchronous (Hammerspoon's hs.http is sync).

local daemonClient = {}

local DAEMON_URL = "http://127.0.0.1:7777"

-- ── Internal helpers ─────────────────────────────────────────────

local function jsonEncode(data)
    return hs.json.encode(data)
end

local function jsonDecode(str)
    if not str or str == "" then return nil end
    local ok, result = pcall(hs.json.decode, str)
    if ok then return result end
    return nil
end

local function httpGet(path)
    local status, body = hs.http.get(DAEMON_URL .. path, nil)
    if status ~= 200 then return nil end
    return jsonDecode(body)
end

local function httpPost(path, data)
    local headers = { ["Content-Type"] = "application/json" }
    local status, body = hs.http.post(DAEMON_URL .. path, jsonEncode(data), headers)
    if status < 200 or status >= 300 then return nil end
    return jsonDecode(body)
end

-- ── Public API ───────────────────────────────────────────────────

--- Check if the daemon is reachable.
function daemonClient.isAvailable()
    local result = httpGet("/health")
    return result ~= nil and result.status == "ok"
end

--- Announce an agent to the daemon.
--- @param agent table { name, protocol, capabilities, resources, endpoint }
function daemonClient.announce(agent)
    return httpPost("/agents/announce", agent)
end

--- Query agents on the bridge.
--- @param filter table optional { name, protocol, status }
function daemonClient.discover(filter)
    local params = ""
    if filter then
        local parts = {}
        for k, v in pairs(filter) do
            table.insert(parts, k .. "=" .. hs.http.encodeForQuery(tostring(v)))
        end
        if #parts > 0 then
            params = "?" .. table.concat(parts, "&")
        end
    end
    return httpGet("/agents" .. params)
end

--- Poll inbox for messages addressed to an agent.
--- @param agentName string
function daemonClient.pollInbox(agentName)
    return httpGet("/messages/" .. hs.http.encodeForQuery(agentName))
end

--- Mark a message as delivered.
--- @param messageId string
function daemonClient.markDelivered(messageId)
    return httpPost("/messages/" .. messageId .. "/delivered", {})
end

--- Acknowledge a message with a result.
--- @param messageId string
--- @param result table { status, data }
function daemonClient.acknowledge(messageId, result)
    return httpPost("/messages/" .. messageId .. "/ack", result or { status = "completed" })
end

--- Get the status of the daemon.
function daemonClient.status()
    return httpGet("/health")
end

return daemonClient
