// the-bridge configuration
// All values can be overridden via environment variables prefixed with BRIDGE_

const config = {
  // HTTP server
  port: parseInt(process.env.BRIDGE_PORT || '7777', 10),
  host: process.env.BRIDGE_HOST || '127.0.0.1',

  // Agent registry
  heartbeatIntervalMs: parseInt(process.env.BRIDGE_HEARTBEAT_INTERVAL || '30000', 10),
  heartbeatTimeoutMs: parseInt(process.env.BRIDGE_HEARTBEAT_TIMEOUT || '90000', 10),

  // Message queue
  messageTtlMs: parseInt(process.env.BRIDGE_MESSAGE_TTL || String(24 * 60 * 60 * 1000), 10),

  // Persistence
  dbPath: process.env.BRIDGE_DB_PATH || './bridge.db',

  // Logging
  logLevel: process.env.BRIDGE_LOG_LEVEL || 'info',
};

export default config;
