import { WebSocketTransport } from './websocket-transport';
import { sessionManager } from '../session/session-manager';
import { currentCollaborationScopes } from '../tools/collaboration/scopes';

/**
 * The WebSocket transport listed and ran the collaboration tools under the session's or the deployment's default
 * scopes and dropped the scopes of the connection's bearer token: with chat enabled and no scope list, an `mcp.read`
 * token reached `post_chat_message`. It now holds the scopes of the token's latest validation (at connect, then before
 * every message), and only a connection without a token falls back to its session and the deployment.
 *
 * The transport is built without its constructor; the token validator is a stand-in.
 */
describe('WebSocketTransport — collaboration scopes of the bearer token', () => {
	const OPEN = 1;
	const TOOLS = [{ name: 'list_chat_conversations' }, { name: 'post_chat_message' }, { name: 'get_task' }];
	const saved = { ...process.env };

	beforeEach(() => {
		process.env['GAUZY_MCP_TOOLS_CHAT'] = 'true';
		delete process.env['GAUZY_MCP_TOOLS_SCOPES'];
	});
	afterEach(() => {
		process.env = { ...saved };
		jest.restoreAllMocks();
	});

	function build(validation: () => Record<string, unknown>) {
		const transport = Object.create(WebSocketTransport.prototype) as any;
		const validateToken = jest.fn(async () => validation());
		Object.assign(transport, {
			transportConfig: { trustedProxies: [] },
			connections: new Map(),
			authorizationConfig: { enabled: true, requiredScopes: ['mcp.read'] },
			tokenValidator: { validateToken },
			cachedTools: TOOLS,
			cacheTimestamp: Date.now(),
			CACHE_TTL: 60_000
		});
		return { transport, validateToken };
	}

	const socket = () => ({ on: jest.fn(), close: jest.fn(), send: jest.fn(), readyState: OPEN, bufferedAmount: 0 });
	const request = (remoteAddress: string, token?: string) =>
		({
			socket: { remoteAddress },
			headers: {
				host: remoteAddress === '127.0.0.1' ? 'localhost:3002' : 'mcp.example.test',
				...(token && { authorization: `Bearer ${token}` })
			},
			url: '/sse'
		}) as any;

	async function listed(transport: any, connection: any): Promise<string[]> {
		const sent: any[] = [];
		await transport.routeMcpRequest(
			'tools/list',
			{},
			1,
			{ start: async () => undefined, close: async () => undefined, send: (r: unknown) => sent.push(r) },
			connection
		);
		return sent[0].result.tools.map((tool: { name: string }) => tool.name);
	}

	async function callScopes(transport: any, connection: any): Promise<string[]> {
		let seen: string[] = [];
		transport.callTool = jest.fn(async () => {
			seen = [...(currentCollaborationScopes() ?? [])].sort();
			return {};
		});
		await transport.routeMcpRequest(
			'tools/call',
			{ name: 'post_chat_message', arguments: {} },
			2,
			{ start: async () => undefined, close: async () => undefined, send: () => undefined },
			connection
		);
		return seen;
	}

	it('an mcp.read-only token neither lists nor runs a chat write tool, even with a session that holds chat:write', async () => {
		jest.spyOn(sessionManager, 'getSession').mockReturnValue({ metadata: { oauthScopes: ['chat:write'] } } as any);
		const { transport } = build(() => ({ valid: true, subject: 'user-1', scopes: ['mcp.read'] }));
		const ws = socket();
		await transport.handleConnection(ws, request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		connection.userContext = { sessionId: 's1' };

		expect(await listed(transport, connection)).toEqual(['list_chat_conversations', 'get_task']);
		expect(await callScopes(transport, connection)).toEqual(['chat:read']);
	});

	it('a token that names chat:read only holds chat:read, though it also has mcp.write', async () => {
		const { transport } = build(() => ({
			valid: true,
			subject: 'user-1',
			scopes: ['mcp.read', 'mcp.write', 'chat:read']
		}));
		await transport.handleConnection(socket(), request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		expect(await listed(transport, connection)).toEqual(['list_chat_conversations', 'get_task']);
		expect(await callScopes(transport, connection)).toEqual(['chat:read']);
	});

	it('takes the scopes of the latest validation of each message (a narrowed token narrows the connection)', async () => {
		let scopes = ['mcp.write'];
		const { transport } = build(() => ({ valid: true, subject: 'user-1', scopes }));
		await transport.handleConnection(socket(), request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		expect(await listed(transport, connection)).toEqual([
			'list_chat_conversations',
			'post_chat_message',
			'get_task'
		]);

		scopes = ['mcp.read'];
		transport.handleMcpMessage = jest.fn(async () => undefined);
		await transport.handleMessage(
			connection,
			Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }))
		);
		expect(connection.tokenScopes).toEqual(['mcp.read']);
		expect(await listed(transport, connection)).toEqual(['list_chat_conversations', 'get_task']);
	});

	it('a token without scopes reaches no collaboration tool', async () => {
		const { transport } = build(() => ({ valid: true, subject: 'user-1' }));
		await transport.handleConnection(socket(), request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		expect(await listed(transport, connection)).toEqual(['get_task']);
		expect(await callScopes(transport, connection)).toEqual([]);
	});

	it('a token admitted on chat:read alone lists and runs the chat reads only, and no other tool', async () => {
		const { transport } = build(() => ({
			valid: true,
			subject: 'user-1',
			scopes: ['chat:read'],
			collaborationOnly: true
		}));
		await transport.handleConnection(socket(), request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		expect(await listed(transport, connection)).toEqual(['list_chat_conversations']);
		transport.callTool = jest.fn(async () => ({}));
		const sent: any[] = [];
		await transport.routeMcpRequest(
			'tools/call',
			{ name: 'get_task', arguments: {} },
			4,
			{ start: async () => undefined, close: async () => undefined, send: (r: unknown) => sent.push(r) },
			connection
		);
		expect(transport.callTool).not.toHaveBeenCalled();
		expect(sent[0].error.data).toContain("Tool 'get_task' not found");
	});

	it('a connection from this machine without a token keeps the session / deployment fallback', async () => {
		const { transport } = build(() => ({ valid: false }));
		await transport.handleConnection(socket(), request('127.0.0.1'));
		const connection = [...transport.connections.values()][0];
		expect(await listed(transport, connection)).toEqual([
			'list_chat_conversations',
			'post_chat_message',
			'get_task'
		]);
		expect(await callScopes(transport, connection)).toEqual(['chat:read', 'chat:write']);
	});
});
