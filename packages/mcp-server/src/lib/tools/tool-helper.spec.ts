/**
 * The tool helpers hand a tool's hints to the server, which lists them with the tool.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { registerCollaborationTool } from './collaboration/collaboration-tool';
import { registerNoArgsTool, registerTool, ToolResult } from './tool-helper';

const DELETION: ToolAnnotations = {
	readOnlyHint: false,
	destructiveHint: true,
	idempotentHint: true,
	openWorldHint: false
};
const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

const answered = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });

/** A client connected to the server over the SDK's in-memory transport, as a stdio client would be. */
async function connectedClient(server: McpServer): Promise<Client> {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'tool-helper-spec', version: '0.0.0' });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return client;
}

describe('tool helpers', () => {
	it('list the hints each tool is registered with', async () => {
		const server = new McpServer({ name: 'tool-helper-spec', version: '0.0.0' });
		registerTool(
			server,
			'delete_thing',
			'Delete a thing',
			{ id: z.string().uuid() },
			async () => answered('deleted'),
			DELETION
		);
		registerNoArgsTool(server, 'thing_status', 'The status of the things', async () => answered('fine'), READ);
		registerCollaborationTool(server, 'get_inbox_counts', 'The inbox counts', {}, async () => answered('0'), READ);
		const client = await connectedClient(server);

		try {
			const { tools } = await client.listTools();
			const hintsOf = (name: string) => tools.find((tool) => tool.name === name)?.annotations;

			expect(hintsOf('delete_thing')).toEqual(DELETION);
			expect(hintsOf('thing_status')).toEqual(READ);
			expect(hintsOf('get_inbox_counts')).toEqual(READ);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it('keep the input schema and the callback of a tool registered with hints', async () => {
		const server = new McpServer({ name: 'tool-helper-spec', version: '0.0.0' });
		const callback = jest.fn(async ({ id }: { id: string }) => answered(`deleted ${id}`));
		registerTool(server, 'delete_thing', 'Delete a thing', { id: z.string().uuid() }, callback, DELETION);
		const client = await connectedClient(server);

		try {
			const id = '00000000-0000-4000-8000-000000000001';
			const result = await client.callTool({ name: 'delete_thing', arguments: { id } });
			const refused = await client.callTool({ name: 'delete_thing', arguments: { id: 'not-a-uuid' } });

			expect(result.content).toEqual([{ type: 'text', text: `deleted ${id}` }]);
			expect(refused.isError).toBe(true);
			expect(callback).toHaveBeenCalledTimes(1);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it('register a tool given no hints as before', async () => {
		const server = new McpServer({ name: 'tool-helper-spec', version: '0.0.0' });
		registerTool(server, 'get_thing', 'Get a thing', { id: z.string().uuid() }, async () => answered('thing'));
		const client = await connectedClient(server);

		try {
			const { tools } = await client.listTools();

			expect(tools.map((tool) => tool.name)).toEqual(['get_thing']);
			expect(tools[0].annotations).toBeUndefined();
		} finally {
			await client.close();
			await server.close();
		}
	});
});
