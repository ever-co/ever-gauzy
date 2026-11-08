/**
 * The shared server registers every enabled collaboration group, because the HTTP and WebSocket transports decide per
 * request what a caller reaches. An SDK transport (stdio) lists and calls the tools itself, so when it connects the
 * server first removes the collaboration tools the deployment's fallback scopes (`GAUZY_MCP_TOOLS_SCOPES`) do not allow.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ExtendedMcpServer } from './mcp-server';
import { registerCollaborationTools } from './tools/collaboration';

describe('ExtendedMcpServer — collaboration tools on an SDK transport', () => {
	const saved = { ...process.env };
	afterEach(() => {
		process.env = { ...saved };
	});

	async function listedOverSdkTransport(env: Record<string, string>): Promise<string[]> {
		Object.assign(process.env, env);
		const server = new ExtendedMcpServer(
			{ name: 'collaboration-spec', version: '0.0.0' },
			{ capabilities: { tools: {} } }
		);
		registerCollaborationTools(server, undefined, process.env);
		// Registered for every caller first, writes included: HTTP and WebSocket filter per request.
		expect((await server.listTools()).map((tool) => tool.name)).toEqual(
			expect.arrayContaining(['list_chat_conversations', 'post_chat_message'])
		);
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		const client = new Client({ name: 'collaboration-spec-client', version: '0.0.0' });
		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
		try {
			return (await client.listTools()).tools.map((tool) => tool.name).sort();
		} finally {
			await client.close();
			await server.close();
		}
	}

	it("keeps only what the deployment's fallback scopes allow", async () => {
		expect(
			await listedOverSdkTransport({
				GAUZY_MCP_TOOLS_CHAT: 'true',
				GAUZY_MCP_TOOLS_DOCS: 'true',
				GAUZY_MCP_TOOLS_SCOPES: 'docs:read'
			})
		).toEqual(['get_page', 'list_pages', 'search_pages']);
	});

	it('keeps every enabled tool without a fallback list (a local server speaks for its one user)', async () => {
		delete process.env['GAUZY_MCP_TOOLS_SCOPES'];
		expect(await listedOverSdkTransport({ GAUZY_MCP_TOOLS_CHAT: 'true' })).toEqual([
			'get_chat_thread',
			'list_chat_conversations',
			'list_chat_messages',
			'mark_chat_conversation_read',
			'post_chat_message',
			'search_chat_messages'
		]);
	});
});
