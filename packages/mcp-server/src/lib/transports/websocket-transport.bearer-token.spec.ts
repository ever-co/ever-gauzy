import { WebSocketTransport } from './websocket-transport';

/**
 * Owner decision 7 (2026-10-22): bearer tokens are required by default, checked through mcp-auth's introspection,
 * and only the loopback desktop mode skips them.
 *
 * The WebSocket transport checked no bearer token at all: any caller that could reach the port opened a connection
 * and ran tools. A connection now opens only with an active token (or from this machine without one), and the token
 * is checked again before each message, so a revoked token or a deactivated user ends the connection.
 *
 * The transport is built without its constructor; the token validator is a stand-in.
 */
describe('WebSocketTransport — bearer tokens', () => {
	const OPEN = 1;

	function build(validation: () => Record<string, unknown>) {
		const transport = Object.create(WebSocketTransport.prototype) as any;
		const validateToken = jest.fn(async () => validation());
		Object.assign(transport, {
			transportConfig: { trustedProxies: [] },
			connections: new Map(),
			authorizationConfig: { enabled: true, requiredScopes: ['mcp.read'] },
			tokenValidator: { validateToken }
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

	it('refuses a connection from elsewhere without a token', async () => {
		const { transport } = build(() => ({ valid: true }));
		const ws = socket();

		await transport.handleConnection(ws, request('203.0.113.7'));

		expect(ws.close).toHaveBeenCalledWith(1008, 'Authorization required');
		expect(transport.connections.size).toBe(0);
	});

	it('refuses a connection whose token is not active', async () => {
		const { transport, validateToken } = build(() => ({ valid: false, error: 'Token is not active' }));
		const ws = socket();

		await transport.handleConnection(ws, request('203.0.113.7', 'revoked'));

		expect(validateToken).toHaveBeenCalledWith('revoked', ['mcp.read']);
		expect(ws.close).toHaveBeenCalledWith(1008, 'Invalid token');
		expect(transport.connections.size).toBe(0);
	});

	it('opens a connection with an active token', async () => {
		const { transport } = build(() => ({ valid: true, subject: 'user-1' }));
		const ws = socket();

		await transport.handleConnection(ws, request('203.0.113.7', 'good'));

		expect(ws.close).not.toHaveBeenCalled();
		expect([...transport.connections.values()][0]).toMatchObject({ bearerToken: 'good', isLocal: false });
	});

	it('opens a connection from this machine without a token (loopback desktop mode)', async () => {
		const { transport, validateToken } = build(() => ({ valid: false }));
		const ws = socket();

		await transport.handleConnection(ws, request('127.0.0.1'));

		expect(ws.close).not.toHaveBeenCalled();
		expect(validateToken).not.toHaveBeenCalled();
		expect([...transport.connections.values()][0]).toMatchObject({ isLocal: true });
	});

	it('closes the connection once its token is no longer active, before running the message', async () => {
		let active = true;
		const { transport } = build(() => (active ? { valid: true } : { valid: false, error: 'Token is not active' }));
		const ws = socket();
		await transport.handleConnection(ws, request('203.0.113.7', 'good'));
		const connection = [...transport.connections.values()][0];
		transport.handleMcpMessage = jest.fn(async () => undefined);
		const message = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));

		await transport.handleMessage(connection, message);
		expect(transport.handleMcpMessage).toHaveBeenCalledTimes(1);

		active = false;
		await transport.handleMessage(connection, message);

		expect(transport.handleMcpMessage).toHaveBeenCalledTimes(1);
		expect(ws.close).toHaveBeenCalledWith(1008, 'Token is no longer valid');
	});

	/**
	 * The `message` listener was attached only after the token check (an introspection call) and the session check
	 * finished. A client that sent `initialize` as soon as the socket opened sent it to no listener, and waited for an
	 * answer that never came.
	 */
	describe('messages sent while the connection is being authorized', () => {
		/** A socket whose listeners can be called, as `ws` calls them on a frame or a close */
		const listeningSocket = () => {
			const listeners = new Map<string, (...args: any[]) => void>();
			return {
				...socket(),
				on: jest.fn((event: string, listener: (...args: any[]) => void) => listeners.set(event, listener)),
				emit: (event: string, ...args: any[]) => listeners.get(event)?.(...args)
			};
		};

		/** A transport whose token check finishes when `finish` is called, and whose message handling is recorded */
		function buildChecking() {
			const { transport, validateToken } = build(() => ({ valid: true }));
			let finish: (validation: Record<string, unknown>) => void = () => undefined;
			validateToken.mockImplementationOnce(
				() => new Promise<Record<string, unknown>>((resolve) => (finish = resolve))
			);
			const handled: string[] = [];
			transport.handleMessage = jest.fn(async (_connection: unknown, data: Buffer) => {
				handled.push(data.toString());
			});
			const ws = listeningSocket();
			// Runs up to the token check, which is then pending
			const connecting = transport.handleConnection(ws, request('203.0.113.7', 'good'));
			return { transport, ws, handled, connecting, finish };
		}

		it('answers them once the connection is accepted, in the order they were sent', async () => {
			const { transport, ws, handled, connecting, finish } = buildChecking();

			ws.emit('message', Buffer.from('initialize'));
			ws.emit('message', Buffer.from('tools/list'));
			expect(handled).toEqual([]);

			finish({ valid: true, subject: 'user-1' });
			await connecting;

			expect(handled).toEqual(['initialize', 'tools/list']);
			expect(transport.connections.size).toBe(1);

			ws.emit('message', Buffer.from('tools/call'));
			expect(handled).toEqual(['initialize', 'tools/list', 'tools/call']);
		});

		it('drops them when the token is refused', async () => {
			const { transport, ws, handled, connecting, finish } = buildChecking();

			ws.emit('message', Buffer.from('initialize'));
			finish({ valid: false, error: 'Token is not active' });
			await connecting;

			expect(ws.close).toHaveBeenCalledWith(1008, 'Invalid token');
			expect(handled).toEqual([]);
			expect(transport.connections.size).toBe(0);
		});

		it('refuses a connection that sends too many of them', async () => {
			const { transport, ws, handled, connecting, finish } = buildChecking();

			for (let i = 0; i < 40; i++) {
				ws.emit('message', Buffer.from(`message ${i}`));
			}
			expect(ws.close).toHaveBeenCalledWith(1008, 'Too many messages before the connection was authorized');

			finish({ valid: true, subject: 'user-1' });
			await connecting;

			expect(handled).toEqual([]);
			expect(transport.connections.size).toBe(0);
		});

		it('keeps nothing of a client that left during the check', async () => {
			const { transport, ws, handled, connecting, finish } = buildChecking();

			ws.emit('message', Buffer.from('initialize'));
			ws.readyState = 3; // CLOSED
			ws.emit('close', 1006, Buffer.from(''));
			finish({ valid: true, subject: 'user-1' });
			await connecting;

			expect(handled).toEqual([]);
			expect(transport.connections.size).toBe(0);
		});
	});
});
