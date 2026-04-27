// Message router — determines delivery path based on recipient's protocol
// Protocol agents get direct delivery. UI agents get queued for Hammerspoon pickup.

export class Router {
  #registry;
  #queue;
  #sseClients; // Map<agentName, Set<response>>

  constructor(registry, queue) {
    this.#registry = registry;
    this.#queue = queue;
    this.#sseClients = new Map();
  }

  /**
   * Route a message to its recipient.
   * Returns the enqueued message with routing metadata.
   */
  route(message) {
    const recipient = this.#registry.getByName(message.to);

    // Determine delivery method
    let delivery = 'queued'; // default: queue for polling
    if (recipient && recipient.protocol !== 'ui') {
      // Protocol-level agents could get direct delivery via SSE
      delivery = 'direct';
    }

    const enqueued = this.#queue.enqueue({
      ...message,
      delivery,
    });

    // Notify via SSE if the recipient has an active connection
    this.#notifySSE(message.to, {
      type: 'message',
      messageId: enqueued.id,
      from: message.from,
      messageType: message.type || 'task',
    });

    const agentInfo = recipient
      ? `${recipient.name} (${recipient.protocol})`
      : `${message.to} (unknown — queued)`;
    console.log(`[router] ${message.from} → ${agentInfo}: ${message.type || 'task'}`);

    return enqueued;
  }

  /**
   * Register an SSE client for push notifications.
   */
  addSSEClient(agentName, res) {
    if (!this.#sseClients.has(agentName)) {
      this.#sseClients.set(agentName, new Set());
    }
    this.#sseClients.get(agentName).add(res);

    // Clean up on disconnect
    res.on('close', () => {
      this.#sseClients.get(agentName)?.delete(res);
    });
  }

  /**
   * Broadcast an event to all SSE clients.
   */
  broadcast(event) {
    for (const [, clients] of this.#sseClients) {
      for (const res of clients) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }
  }

  /**
   * Send an SSE notification to a specific agent.
   */
  #notifySSE(agentName, event) {
    const clients = this.#sseClients.get(agentName);
    if (!clients || clients.size === 0) return;

    for (const res of clients) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }
}
