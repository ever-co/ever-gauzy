/**
 * The HTTP and WebSocket transports answer tools/list with `ExtendedMcpServer.listTools()`: each tool is listed there
 * with the hints it declares, as the SDK's own tools/list lists them.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ExtendedMcpServer } from './mcp-server';
import { registerTool, ToolResult } from './tools/tool-helper';

const DELETION: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: true,
	idempotentHint: true,
	openWorldHint: false
};

const answered = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });

describe('ExtendedMcpServer.listTools', () => {
	it('lists the hints a tool declares, and none for a tool that declares none', async () => {
		const server = new ExtendedMcpServer(
			{ name: 'list-tools-spec', version: '0.0.0' },
			{ capabilities: { tools: {} } }
		);
		registerTool(
			server,
			'delete_thing',
			'Delete a thing',
			{ id: z.string().uuid() },
			async () => answered('deleted'),
			DELETION
		);
		registerTool(server, 'get_thing', 'Get a thing', { id: z.string().uuid() }, async () => answered('thing'));

		const tools = await server.listTools();
		const deletion = tools.find((tool) => tool.name === 'delete_thing');
		const read = tools.find((tool) => tool.name === 'get_thing');

		expect(deletion?.annotations).toEqual(DELETION);
		expect(deletion?.description).toBe('Delete a thing');
		expect(read).toBeDefined();
		expect(read).not.toHaveProperty('annotations');
	});
});
