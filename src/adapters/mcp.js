// MCP protocol adapter for the-bridge
// Exposes bridge operations as MCP tools that AI agents can call.
// Can run as a stdio server (for Claude Desktop, Cursor) or HTTP server.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:7777';

// HTTP client to the bridge daemon
async function bridgeRequest(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BRIDGE_URL}${path}`, options);
  return res.json();
}

const server = new McpServer({
  name: 'the-bridge',
  version: '0.1.0',
});

// ── bridge_announce ─────────────────────────────────────────────
server.tool(
  'bridge_announce',
  'Register an agent on the-bridge. The agent becomes discoverable by other agents.',
  {
    name: z.string().describe('Agent name (e.g., "cursor", "antigravity", "claude")'),
    protocol: z.enum(['mcp', 'a2a', 'ui', 'custom']).default('mcp').describe('Communication protocol'),
    capabilities: z.array(z.string()).default([]).describe('List of capabilities (e.g., "code-edit", "file-read", "terminal")'),
    resources: z.array(z.string()).default([]).describe('Resources this agent controls (e.g., "workspace:/path/to/repo")'),
  },
  async ({ name, protocol, capabilities, resources }) => {
    const result = await bridgeRequest('POST', '/agents/announce', {
      name,
      protocol,
      capabilities,
      resources,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
);

// ── bridge_discover ─────────────────────────────────────────────
server.tool(
  'bridge_discover',
  'Discover agents currently on the-bridge. Returns a list of present agents with their capabilities.',
  {
    name: z.string().optional().describe('Filter by agent name'),
    protocol: z.string().optional().describe('Filter by protocol (mcp, a2a, ui, custom)'),
  },
  async ({ name, protocol }) => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (protocol) params.set('protocol', protocol);
    const query = params.toString() ? `?${params}` : '';

    const agents = await bridgeRequest('GET', `/agents${query}`);
    return {
      content: [{
        type: 'text',
        text: agents.length === 0
          ? 'No agents currently on the bridge.'
          : JSON.stringify(agents, null, 2),
      }],
    };
  },
);

// ── bridge_send ─────────────────────────────────────────────────
server.tool(
  'bridge_send',
  'Send a task or message to another agent through the-bridge. The message is routed based on the recipient\'s protocol.',
  {
    to: z.string().describe('Recipient agent name'),
    from: z.string().default('mcp-client').describe('Sender agent name'),
    type: z.enum(['task', 'message', 'response']).default('task').describe('Message type'),
    instruction: z.string().describe('The instruction or message content'),
    context: z.record(z.any()).optional().describe('Additional context (repo path, file list, etc.)'),
    requiresApproval: z.boolean().default(false).describe('Whether the recipient must approve before executing'),
  },
  async ({ to, from, type, instruction, context, requiresApproval }) => {
    const result = await bridgeRequest('POST', '/messages', {
      from,
      to,
      type,
      payload: { instruction, context },
      requiresApproval,
    });
    return {
      content: [{
        type: 'text',
        text: `Message sent to ${to}.\n${JSON.stringify(result, null, 2)}`,
      }],
    };
  },
);

// ── bridge_inbox ────────────────────────────────────────────────
server.tool(
  'bridge_inbox',
  'Check for messages addressed to this agent on the-bridge.',
  {
    agent: z.string().describe('Agent name to check inbox for'),
  },
  async ({ agent }) => {
    const messages = await bridgeRequest('GET', `/messages/${encodeURIComponent(agent)}`);
    return {
      content: [{
        type: 'text',
        text: messages.length === 0
          ? 'No pending messages.'
          : JSON.stringify(messages, null, 2),
      }],
    };
  },
);

// ── bridge_respond ──────────────────────────────────────────────
server.tool(
  'bridge_respond',
  'Respond to a message received from another agent. Acknowledges the message and optionally includes result data.',
  {
    messageId: z.string().describe('ID of the message to respond to'),
    status: z.enum(['completed', 'failed', 'rejected']).default('completed').describe('Outcome status'),
    data: z.record(z.any()).optional().describe('Response data'),
  },
  async ({ messageId, status, data }) => {
    const result = await bridgeRequest('POST', `/messages/${messageId}/ack`, { status, data });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
);

// ── bridge_message_status ───────────────────────────────────────
server.tool(
  'bridge_message_status',
  'Check the delivery and execution status of a previously sent message.',
  {
    messageId: z.string().describe('ID of the message to check'),
  },
  async ({ messageId }) => {
    const result = await bridgeRequest('GET', `/messages/${messageId}/status`);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
);

// ── bridge_status ───────────────────────────────────────────────
server.tool(
  'bridge_status',
  'Get the-bridge daemon status: health, uptime, connected agent count.',
  {},
  async () => {
    const result = await bridgeRequest('GET', '/health');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[bridge-mcp] MCP adapter connected via stdio');
