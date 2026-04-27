// Message queue — SQLite-backed persistent message queue
// Messages persist until acknowledged or expired.

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import config from '../bridge.config.js';

export class Queue {
  #db;
  #sweepInterval;

  constructor(dbPath = config.dbPath) {
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#initSchema();
    this.#sweepInterval = setInterval(() => this.#sweepExpired(), 60_000);
  }

  #initSchema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'task',
        payload TEXT NOT NULL DEFAULT '{}',
        delivery TEXT NOT NULL DEFAULT 'pending',
        status TEXT NOT NULL DEFAULT 'pending',
        requires_approval INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        acknowledged_at TEXT,
        expires_at TEXT NOT NULL
      )
    `);
    this.#db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent, status)
    `);
    this.#db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent)
    `);
  }

  #sweepExpired() {
    const now = new Date().toISOString();
    const result = this.#db.prepare(`
      UPDATE messages SET status = 'expired'
      WHERE status IN ('pending', 'delivered') AND expires_at < ?
    `).run(now);

    if (result.changes > 0) {
      console.log(`[queue] expired ${result.changes} message(s)`);
    }
  }

  /**
   * Add a message to the queue.
   */
  enqueue(message) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.messageTtlMs).toISOString();

    this.#db.prepare(`
      INSERT INTO messages (id, from_agent, to_agent, type, payload, delivery, status, requires_approval, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(
      id,
      message.from,
      message.to,
      message.type || 'task',
      JSON.stringify(message.payload || {}),
      message.delivery || 'pending',
      message.requiresApproval ? 1 : 0,
      now,
      now,
      expiresAt,
    );

    return {
      id,
      from: message.from,
      to: message.to,
      type: message.type || 'task',
      status: 'pending',
      createdAt: now,
      expiresAt,
    };
  }

  /**
   * Get pending messages for an agent (inbox).
   */
  dequeue(agentName) {
    const rows = this.#db.prepare(`
      SELECT * FROM messages
      WHERE to_agent = ? AND status = 'pending'
      ORDER BY created_at ASC
    `).all(agentName);

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload),
      requiresApproval: !!row.requires_approval,
    }));
  }

  /**
   * Mark a message as delivered (picked up by the recipient).
   */
  markDelivered(messageId) {
    const now = new Date().toISOString();
    const result = this.#db.prepare(`
      UPDATE messages SET status = 'delivered', updated_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(now, messageId);
    return result.changes > 0;
  }

  /**
   * Acknowledge a message with a result.
   */
  acknowledge(messageId, result = {}) {
    const now = new Date().toISOString();
    const res = this.#db.prepare(`
      UPDATE messages SET
        status = ?,
        payload = json_set(payload, '$.result', json(?)),
        acknowledged_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      result.status || 'completed',
      JSON.stringify(result.data || {}),
      now,
      now,
      messageId,
    );
    return res.changes > 0;
  }

  /**
   * Get a message by ID (for status checks).
   */
  status(messageId) {
    const row = this.#db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload),
      requiresApproval: !!row.requires_approval,
    };
  }

  /**
   * Get recent messages across all agents (for the viewscreen).
   */
  recent(limit = 50) {
    const rows = this.#db.prepare(`
      SELECT * FROM messages
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return rows.map(row => ({
      ...row,
      payload: JSON.parse(row.payload),
      requiresApproval: !!row.requires_approval,
    }));
  }

  /**
   * Clean shutdown.
   */
  close() {
    clearInterval(this.#sweepInterval);
    this.#db.close();
  }
}
