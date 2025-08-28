/**
 * WebSocket Client Example for MCP Server
 *
 * This example demonstrates how to connect to and interact with
 * the MCP WebSocket transport.
 *
 * Usage:
 * 1. Start the MCP server with WebSocket transport:
 *    MCP_TRANSPORT=websocket MCP_WS_PORT=3002 npm start
 *
 * 2. Run this client:
 *    node examples/websocket-client-example.js
 */

const WebSocket = require('ws');

// Global reference for clean shutdown
let globalClient = null;

class McpWebSocketClient {
	constructor(url, options = {}) {
		this.url = url;
		this.ws = null;
		this.requestId = 0;
		this.pendingRequests = new Map();
		this.requestTimeout = options.requestTimeout || 10000;
		this.maxRetries = options.maxRetries || 3;
	}

	async connect() {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url);

			this.ws.on('open', () => {
				console.log('✅ Connected to MCP WebSocket server');
				this.setupMessageHandling();
				resolve();
			});

			this.ws.on('error', (error) => {
				console.error('❌ WebSocket connection error:', error);
				reject(error);
			});
		});
	}

	setupMessageHandling() {
		this.ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				this.handleMessage(message);
			} catch (error) {
				console.error('❌ Error parsing message:', error);
			}
		});

		this.ws.on('close', (code, reason) => {
			console.log(`🔌 Connection closed: ${code} - ${reason}`);
		});

		// Handle ping from server
		this.ws.on('ping', () => {
			console.log('📡 Received ping from server');
		});
	}

	handleMessage(message) {
		console.log('📨 Received message:', JSON.stringify(message, null, 2));

		// Handle welcome message
		if (message.type === 'welcome') {
			console.log(`🎉 Welcome! Connection ID: ${message.connectionId}`);
			console.log('📋 Server features:', message.features);
			return;
		}

		// Handle ping response
		if (message.type === 'pong') {
			console.log('🏓 Received pong from server');
			return;
		}

		// Handle JSON-RPC responses
		if (message.jsonrpc === '2.0' && message.id !== undefined) {
			const pending = this.pendingRequests.get(message.id);
			if (pending) {
				this.pendingRequests.delete(message.id);
				clearTimeout(pending.timeoutId);
				if (message.error) {
					pending.reject(new Error(message.error.message));
				} else {
					pending.resolve(message.result);
				}
			}
		}
	}

	async sendRequest(method, params = {}, retryCount = 0) {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error('WebSocket is not open'));
				return;
			}

			const id = ++this.requestId;
			const request = {
				jsonrpc: '2.0',
				id,
				method,
				params
			};

			// Set timeout
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					if (retryCount < this.maxRetries) {
						// Exponential back off
						setTimeout(() => {
							this.sendRequest(method, params, retryCount + 1)
								.then(resolve)
								.catch(reject);
						}, Math.pow(2, retryCount) * 1000);
					} else {
						reject(new Error(`Request timeout after ${retryCount} retries for method: ${method}`));
					}
				}
			}, this.requestTimeout);

			this.pendingRequests.set(id, { resolve, reject, timeoutId });
			this.ws.send(JSON.stringify(request));
		});
	}

	sendPing() {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error('❌ Cannot send ping: WebSocket is not open');
			return;
		}

		const pingMessage = {
			type: 'ping'
		};
		this.ws.send(JSON.stringify(pingMessage));
		console.log('🏓 Sent ping to server');
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
		}
	}
}

async function runExample() {
	const client = new McpWebSocketClient(process.env.MCP_WS_URL || 'ws://127.0.0.1:3002');
	globalClient = client;

	try {
		// Connect to server
		await client.connect();

		// Wait a bit for welcome message
		await new Promise(resolve => setTimeout(resolve, 1000));

		// Test ping-pong
		console.log('\n🏓 Testing ping-pong...');
		client.sendPing();
		await new Promise(resolve => setTimeout(resolve, 1000));

		// Test MCP initialize
		console.log('\n🔧 Testing MCP initialize...');
		const initResult = await client.sendRequest('initialize', {
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: {
				name: 'websocket-example-client',
				version: '1.0.0'
			}
		});
		console.log('✅ Initialize result:', initResult);

		// Test tools list
		console.log('\n🔧 Testing tools/list...');
		const toolsResult = await client.sendRequest('tools/list');
		console.log('✅ Tools result:', toolsResult);

		// Test unknown method (should return error)
		console.log('\n❌ Testing unknown method...');
		try {
			await client.sendRequest('unknown/method');
		} catch (error) {
			console.log('✅ Expected error for unknown method:', error.message);
		}

		console.log('\n🎉 All tests completed successfully!');

	} catch (error) {
		console.error('❌ Example failed:', error);
	} finally {
		client.disconnect();
	}
}

// Handle process termination
process.on('SIGINT', () => {
	console.log('\n👋 Shutting down...');
	if (globalClient) {
		globalClient.disconnect();
		// Give time for disconnect to complete
		setTimeout(() => {
			process.exit(0);
		}, 100);
	} else {
		process.exit(0);
	}
});

// Run the example
if (require.main === module) {
	runExample().catch(console.error);
}

module.exports = { McpWebSocketClient };
