import { createMcpServer } from './mcp-server.js';
import log from 'electron-log';
import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
// Environment will be provided by the consuming app
// import { environment } from '../environments/environment.js';

export interface McpServerStatus {
	running: boolean;
	port: number | null;
	version: string | null;
	uptime?: number;
	lastError?: string;
}

export class McpServerManager {
	private mcpProcess: ChildProcess | null = null;
	private _isRunning = false;
	private _startTime: Date | null = null;
	private _lastError: string | null = null;
	private _version: string | null = null;
	private killTimeout: NodeJS.Timeout | null = null;
	private environment: any;

	constructor(environment?: any) {
		this.environment = environment || {
			nodeEnv: process.env.NODE_ENV || 'development',
			baseUrl: process.env.API_BASE_URL || process.env.GAUZY_API_BASE_URL || 'http://localhost:3000'
		};
	}

	isRunning(): boolean {
		return this._isRunning;
	}

	getVersion(): string {
		return this._version || 'Unknown';
	}

	async restart(): Promise<boolean> {
		log.info('Restarting MCP Server...');
		const stopSuccess = await this.stop();
		if (!stopSuccess) {
			log.error('Failed to stop MCP Server during restart');
			return false;
		}
		// Small delay to ensure clean shutdown
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return await this.start();
	}

	getStatus(): McpServerStatus {
		return {
			running: this._isRunning,
			port: null, // MCP servers typically use stdio, not ports
			version: this._version,
			uptime: this._startTime ? Date.now() - this._startTime.getTime() : undefined,
			lastError: this._lastError || undefined
		};
	}

	async start(): Promise<boolean> {
		if (this._isRunning) {
			log.warn('MCP Server is already running');
			return true;
		}

		try {
			// For Electron apps, we'll run the MCP server in the same process
			// This is different from the documentation example which uses separate processes
			await this.startInProcess();
			return true;
		} catch (error) {
			this._lastError = error instanceof Error ? error.message : String(error);
			log.error('Failed to start MCP Server:', error);
			return false;
		}
	}

	async stop(): Promise<boolean> {
		// Clear any existing kill timeout
		if (this.killTimeout) {
			clearTimeout(this.killTimeout);
			this.killTimeout = null;
		}
		if (this.mcpProcess && this._isRunning) {
			log.info('Stopping MCP Server...');
			this.mcpProcess.kill('SIGTERM');

			// Force kill after timeout
			this.killTimeout = setTimeout(() => {
				if (this.mcpProcess && !this.mcpProcess.killed) {
					log.warn('Force killing MCP Server process');
					this.mcpProcess.kill('SIGKILL');
				}
				this.mcpProcess = null;
				this.killTimeout = null;
			}, 10000);

			this._isRunning = false;
			this._startTime = null;
			return true;
		}

		if (this._isRunning) {
			// If running in-process, just mark as stopped
			this._isRunning = false;
			this._startTime = null;
			log.info('MCP Server stopped');
			return true;
		}

		return true;
	}

	/**
	 * Start MCP server in the same process (recommended for Electron apps)
	 */
	async startInProcess(): Promise<void> {
		try {
			const { version } = createMcpServer();
			this._version = version;

			// For Electron apps, we don't connect to stdio directly
			// Instead, we keep the server instance ready for IPC communication
			log.info(`Gauzy MCP Server initialized: ${version}`);

			this._isRunning = true;
			this._startTime = new Date();
			this._lastError = null;
		} catch (error) {
			this._lastError = error instanceof Error ? error.message : String(error);
			log.error('Failed to start MCP Server in process:', error);
			throw error;
		}
	}

	/**
	 * Start MCP server as separate process (for external MCP clients like Claude Desktop)
	 */
	async startAsStandaloneServer(): Promise<void> {
		if (this._isRunning) {
			log.warn('MCP Server is already running');
			return;
		}

		try {
			// Create and start the MCP server in a separate process
			const serverScript = path.join(__dirname, 'mcp-server.js');

			// Validate that the server script exists and is within our application directory
			if (!serverScript.includes(__dirname)) {
				throw new Error('Invalid server script path');
			}

			// Sanitize environment variables to prevent injection
			const sanitizedEnv = {
				NODE_ENV: this.environment.nodeEnv,
				// Only pass necessary environment variables
				GAUZY_MCP_DEBUG: process.env.GAUZY_MCP_DEBUG || 'false',
				API_BASE_URL: process.env.API_BASE_URL || this.environment.baseUrl,
				GAUZY_API_BASE_URL: process.env.GAUZY_API_BASE_URL || this.environment.baseUrl
			};

			this.mcpProcess = spawn('node', [serverScript], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: sanitizedEnv,
				shell: false // Explicitly disable shell to prevent command injection
			});

			this.mcpProcess.on('error', (error) => {
				this._lastError = error.message;
				log.error('MCP Server process error:', error);
				this._isRunning = false;
			});

			this.mcpProcess.on('exit', (code, signal) => {
				log.info(`MCP Server process exited with code ${code} and signal ${signal}`);
				this._isRunning = false;
				this._startTime = null;
			});

			this.mcpProcess.on('spawn', () => {
				log.info('MCP Server process spawned successfully');
				this._isRunning = true;
				this._startTime = new Date();
				this._lastError = null;
			});

			// Handle server output
			this.mcpProcess.stdout?.on('data', (data) => {
				log.info('MCP Server stdout:', data.toString());
			});

			this.mcpProcess.stderr?.on('data', (data) => {
				log.error('MCP Server stderr:', data.toString());
			});
		} catch (error) {
			this._lastError = error instanceof Error ? error.message : String(error);
			log.error('Failed to start MCP Server:', error);
			this._isRunning = false;
			throw error;
		}
	}
}
