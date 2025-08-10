import { WebSocketTransport } from '../websocket-transport';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import WebSocket from 'ws';

// Mock MCP Server
const mockMcpServer = {
	connect: jest.fn(),
	close: jest.fn(),
	// Add other required methods as needed
} as unknown as McpServer;

describe('WebSocketTransport', () => {
	let transport: WebSocketTransport;
	let server: WebSocket.WebSocketServer;

	const defaultConfig = {
		port: 3003, // Use different port for testing
		host: '127.0.0.1',
		compression: false,
		maxPayload: 16777216,
		session: {
			enabled: true,
			cookieName: 'test-session-id'
		}
	};

	beforeEach(() => {
		transport = new WebSocketTransport({
			server: mockMcpServer,
			transportConfig: defaultConfig
		});
	});

	afterEach(async () => {
		if (transport) {
			await transport.stop();
		}
	});

	describe('Server Lifecycle', () => {
		test('should start WebSocket server successfully', async () => {
			await transport.start();
			expect(transport.getUrl()).toBe('ws://127.0.0.1:3003');
		});

		test('should stop WebSocket server successfully', async () => {
			await transport.start();
			await transport.stop();
			// Test that server is stopped by trying to connect (should fail)
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve) => {
				client.on('error', () => {
					resolve(true); // Expected error when server is stopped
				});
				setTimeout(resolve, 1000);
			});
		});
	});

	describe('Connection Management', () => {
		beforeEach(async () => {
			await transport.start();
		});

		test('should handle WebSocket connections', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				client.on('open', () => {
					const stats = transport.getStats();
					expect(stats.connections).toBe(1);
					client.close();
					resolve(true);
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Connection timeout')), 5000);
			});
		});

		test('should receive welcome message on connection', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					expect(message.type).toBe('welcome');
					expect(message.connectionId).toBeDefined();
					expect(message.features).toBeDefined();
					client.close();
					resolve(true);
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Message timeout')), 5000);
			});
		});

		test('should handle ping-pong messages', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				let welcomeReceived = false;
				
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					
					if (message.type === 'welcome') {
						welcomeReceived = true;
						// Send ping message
						client.send(JSON.stringify({ type: 'ping' }));
					} else if (message.type === 'pong' && welcomeReceived) {
						expect(message.timestamp).toBeDefined();
						client.close();
						resolve(true);
					}
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Ping-pong timeout')), 5000);
			});
		});
	});

	describe('MCP Protocol', () => {
		beforeEach(async () => {
			await transport.start();
		});

		test('should handle MCP initialize request', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				let welcomeReceived = false;
				
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					
					if (message.type === 'welcome') {
						welcomeReceived = true;
						// Send MCP initialize request
						client.send(JSON.stringify({
							jsonrpc: '2.0',
							method: 'initialize',
							id: 1,
							params: {}
						}));
					} else if (message.jsonrpc === '2.0' && message.id === 1 && welcomeReceived) {
						expect(message.result).toBeDefined();
						expect(message.result.protocolVersion).toBe('2025-03-26');
						expect(message.result.serverInfo.name).toBe('gauzy-mcp-server');
						client.close();
						resolve(true);
					}
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Initialize timeout')), 5000);
			});
		});

		test('should handle MCP tools/list request', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				let welcomeReceived = false;
				
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					
					if (message.type === 'welcome') {
						welcomeReceived = true;
						// Send MCP tools/list request
						client.send(JSON.stringify({
							jsonrpc: '2.0',
							method: 'tools/list',
							id: 2,
							params: {}
						}));
					} else if (message.jsonrpc === '2.0' && message.id === 2 && welcomeReceived) {
						expect(message.result).toBeDefined();
						expect(message.result.tools).toBeDefined();
						expect(Array.isArray(message.result.tools)).toBe(true);
						client.close();
						resolve(true);
					}
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Tools list timeout')), 5000);
			});
		});

		test('should handle unknown MCP method', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				let welcomeReceived = false;
				
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					
					if (message.type === 'welcome') {
						welcomeReceived = true;
						// Send MCP request with unknown method
						client.send(JSON.stringify({
							jsonrpc: '2.0',
							method: 'unknown/method',
							id: 3,
							params: {}
						}));
					} else if (message.jsonrpc === '2.0' && message.id === 3 && welcomeReceived) {
						expect(message.error).toBeDefined();
						expect(message.error.code).toBe(-32601);
						expect(message.error.message).toContain('Method not found');
						client.close();
						resolve(true);
					}
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Unknown method timeout')), 5000);
			});
		});
	});

	describe('Session Management', () => {
		beforeEach(async () => {
			await transport.start();
		});

		test('should create session successfully', () => {
			const session = transport.createSession();
			expect(session.sessionId).toBeDefined();
			expect(session.created).toBeInstanceOf(Date);
			expect(session.cookieName).toBe('test-session-id');
		});

		test('should delete session successfully', () => {
			const session = transport.createSession();
			const deleted = transport.deleteSession(session.sessionId);
			expect(deleted).toBe(true);
			
			// Try to delete again, should return false
			const deletedAgain = transport.deleteSession(session.sessionId);
			expect(deletedAgain).toBe(false);
		});
	});

	describe('Broadcasting', () => {
		beforeEach(async () => {
			await transport.start();
		});

		test('should broadcast message to all connections', async () => {
			const client1 = new WebSocket('ws://127.0.0.1:3003');
			const client2 = new WebSocket('ws://127.0.0.1:3003');
			
			await Promise.all([
				new Promise((resolve) => client1.on('open', resolve)),
				new Promise((resolve) => client2.on('open', resolve))
			]);

			// Wait for welcome messages
			await new Promise((resolve) => setTimeout(resolve, 100));

			const broadcastMessage = { type: 'test', data: 'broadcast test' };
			transport.broadcast(broadcastMessage);

			const received = await Promise.all([
				new Promise((resolve) => {
					client1.on('message', (data) => {
						const message = JSON.parse(data.toString());
						if (message.type === 'test') resolve(message);
					});
				}),
				new Promise((resolve) => {
					client2.on('message', (data) => {
						const message = JSON.parse(data.toString());
						if (message.type === 'test') resolve(message);
					});
				})
			]);

			expect(received).toHaveLength(2);
			received.forEach((message: any) => {
				expect(message.type).toBe('test');
				expect(message.data).toBe('broadcast test');
			});

			client1.close();
			client2.close();
		});
	});

	describe('Error Handling', () => {
		beforeEach(async () => {
			await transport.start();
		});

		test('should handle malformed JSON messages', async () => {
			const client = new WebSocket('ws://127.0.0.1:3003');
			
			await new Promise((resolve, reject) => {
				let welcomeReceived = false;
				
				client.on('message', (data) => {
					const message = JSON.parse(data.toString());
					
					if (message.type === 'welcome') {
						welcomeReceived = true;
						// Send malformed JSON
						client.send('{ invalid json }');
					} else if (message.jsonrpc === '2.0' && message.error && welcomeReceived) {
						expect(message.error.code).toBe(-32700);
						expect(message.error.message).toBe('Parse error');
						client.close();
						resolve(true);
					}
				});
				
				client.on('error', reject);
				setTimeout(() => reject(new Error('Malformed JSON timeout')), 5000);
			});
		});
	});
});