// Agent registry — SQLite-backed agent discovery and registration
// Agents announce themselves, are discoverable, and can depart.
// Heartbeat-based presence detection marks unresponsive agents as departed.

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import config from '../bridge.config.js';

export class Registry {
  #db;
  #sweepInterval;

  constructor(dbPath = config.dbPath) {
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');
    this.#initSchema();
    this.#markAllDeparted(); // agents from previous run are no longer present
    this.#sweepInterval = setInterval(() => this.#sweepStale(), config.heartbeatTimeoutMs);
  }

  #initSchema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL DEFAULT 'ui',
        capabilities TEXT NOT NULL DEFAULT '[]',
        resources TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'present',
        endpoint TEXT,
        last_seen TEXT NOT NULL,
        announced_at TEXT NOT NULL
      )
    `);
    this.#db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name)
    `);
    this.#db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)
    `);
  }

  // On daemon startup, all agents from a previous session are stale
  #markAllDeparted() {
    this.#db.prepare(`UPDATE agents SET status = 'departed'`).run();
  }

  // Remove agents that haven't heartbeated within the timeout window
  #sweepStale() {
    const cutoff = new Date(Date.now() - config.heartbeatTimeoutMs).toISOString();
    const result = this.#db.prepare(`
      UPDATE agents SET status = 'departed'
      WHERE status = 'present' AND last_seen < ?
    `).run(cutoff);

    if (result.changes > 0) {
      console.log(`[registry] swept ${result.changes} stale agent(s)`);
    }
  }

  /**
   * Register an agent on the bridge.
   * If an agent with the same name exists and is departed, re-activate it.
   * If it's already present, update its record.
   */
  announce(agent) {
    const now = new Date().toISOString();
    const existing = this.#db.prepare(`SELECT id FROM agents WHERE name = ?`).get(agent.name);

    if (existing) {
      this.#db.prepare(`
        UPDATE agents SET
          protocol = ?,
          capabilities = ?,
          resources = ?,
          status = 'present',
          endpoint = ?,
          last_seen = ?
        WHERE id = ?
      `).run(
        agent.protocol || 'ui',
        JSON.stringify(agent.capabilities || []),
        JSON.stringify(agent.resources || []),
        agent.endpoint || null,
        now,
        existing.id,
      );
      return { id: existing.id, name: agent.name, status: 'present', reannounced: true };
    }

    const id = randomUUID();
    this.#db.prepare(`
      INSERT INTO agents (id, name, protocol, capabilities, resources, status, endpoint, last_seen, announced_at)
      VALUES (?, ?, ?, ?, ?, 'present', ?, ?, ?)
    `).run(
      id,
      agent.name,
      agent.protocol || 'ui',
      JSON.stringify(agent.capabilities || []),
      JSON.stringify(agent.resources || []),
      agent.endpoint || null,
      now,
      now,
    );
    return { id, name: agent.name, status: 'present', reannounced: false };
  }

  /**
   * Mark an agent as departed.
   */
  depart(agentId) {
    const result = this.#db.prepare(`
      UPDATE agents SET status = 'departed' WHERE id = ?
    `).run(agentId);
    return result.changes > 0;
  }

  /**
   * Update an agent's last_seen timestamp.
   */
  heartbeat(agentId) {
    const now = new Date().toISOString();
    const result = this.#db.prepare(`
      UPDATE agents SET last_seen = ? WHERE id = ? AND status = 'present'
    `).run(now, agentId);
    return result.changes > 0;
  }

  /**
   * Query agents. Optional filters: name, protocol, capability, status.
   */
  query(filter = {}) {
    let sql = 'SELECT * FROM agents WHERE 1=1';
    const params = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    } else {
      // default: only present agents
      sql += " AND status = 'present'";
    }

    if (filter.name) {
      sql += ' AND name = ?';
      params.push(filter.name);
    }

    if (filter.protocol) {
      sql += ' AND protocol = ?';
      params.push(filter.protocol);
    }

    const rows = this.#db.prepare(sql).all(...params);
    return rows.map(row => ({
      ...row,
      capabilities: JSON.parse(row.capabilities),
      resources: JSON.parse(row.resources),
    }));
  }

  /**
   * Get a single agent by ID.
   */
  get(agentId) {
    const row = this.#db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!row) return null;
    return {
      ...row,
      capabilities: JSON.parse(row.capabilities),
      resources: JSON.parse(row.resources),
    };
  }

  /**
   * Get a single agent by name.
   */
  getByName(name) {
    const row = this.#db.prepare("SELECT * FROM agents WHERE name = ? AND status = 'present'").get(name);
    if (!row) return null;
    return {
      ...row,
      capabilities: JSON.parse(row.capabilities),
      resources: JSON.parse(row.resources),
    };
  }

  /**
   * Clean shutdown.
   */
  close() {
    clearInterval(this.#sweepInterval);
    this.#db.close();
  }
}
