// Base adapter interface
// All protocol adapters extend this class and implement the required methods.
// The adapter translates between its native protocol and the bridge's internal HTTP API.

export class BaseAdapter {
  constructor(registry, router) {
    this.registry = registry;
    this.router = router;
  }

  /**
   * Register an agent through this adapter's protocol.
   * @param {Object} agent - Agent metadata (name, capabilities, resources, endpoint)
   * @returns {Object} Registration result with agent ID
   */
  register(agent) {
    return this.registry.announce(agent);
  }

  /**
   * Unregister an agent.
   * @param {string} agentId
   * @returns {boolean}
   */
  unregister(agentId) {
    return this.registry.depart(agentId);
  }

  /**
   * List agents matching a filter.
   * @param {Object} filter - Optional filters (name, protocol, status)
   * @returns {Array}
   */
  listAgents(filter) {
    return this.registry.query(filter);
  }

  /**
   * Send a message through the router.
   * @param {Object} message
   * @returns {Object}
   */
  sendMessage(message) {
    return this.router.route(message);
  }

  /**
   * Start the adapter. Override in subclasses.
   */
  async start() {
    throw new Error('start() must be implemented by subclass');
  }

  /**
   * Stop the adapter. Override in subclasses.
   */
  async stop() {
    // default: no-op
  }
}
