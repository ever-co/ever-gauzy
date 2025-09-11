// Import logging for electron and override default console logging (CommonJS module)
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

// Import electron modules with error handling
let app: any,
	BrowserWindow: any,
	shell: any,
	ipcMain: any

try {
	const electron = require('electron');
	({ app, BrowserWindow, shell, ipcMain } = electron);
	log.info('Electron modules loaded successfully');
} catch (error) {
	console.error('Failed to load electron modules:', error);
	console.error('This application must be run in an Electron environment');
	process.exit(1);
}
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Import custom-electron-titlebar
let setupTitlebar: any;
try {
	({ setupTitlebar } = await import('custom-electron-titlebar/main'));
} catch (error) {
	console.warn('Failed to load custom-electron-titlebar:', error);
}

// Import environment
import { environment } from '@gauzy/mcp-server';

// Import electron-store (CommonJS module)
const Store = require('electron-store');

// Import MCP Server Manager from shared package
import { McpServerManager } from '@gauzy/mcp-server';
import { securityConfig } from '@gauzy/mcp-server';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup titlebar
setupTitlebar();

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow: any | null = null;
let mcpServerManager: McpServerManager | null = null;
let store: any = null;
let isServerInitialized = false;

// Only set specific environment variables that are needed
if (environment.baseUrl) process.env.API_BASE_URL = environment.baseUrl;
if (environment.apiTimeout) process.env.API_TIMEOUT = String(environment.apiTimeout);
if (environment.debug !== undefined) process.env.GAUZY_MCP_DEBUG = String(environment.debug);

//
try {
	store = new Store();
} catch (error) {
	log.error('Failed to initialize store:', error);
}

// Set unlimited listeners
try {
	if (ipcMain && typeof ipcMain.setMaxListeners === 'function') {
		const MAX_IPC_LISTENERS = Number(process.env.MAX_IPC_LISTENERS || 50);
		ipcMain.setMaxListeners(MAX_IPC_LISTENERS);
	} else {
		log.warn('ipcMain.setMaxListeners not available');
	}
} catch (error) {
	log.error('Failed to set max listeners on ipcMain:', error);
}

// Set security settings - these are safe to call before app ready
try {
	if (app && app.commandLine) {
		app.commandLine.appendSwitch('disable-http2');
		app.commandLine.appendSwitch('in-process-gpu');

		// Fix DevTools autofill and console errors
		app.commandLine.appendSwitch('disable-features', 'Autofill');
		app.commandLine.appendSwitch('disable-background-timer-throttling');
		app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
		app.commandLine.appendSwitch('disable-renderer-backgrounding');
	} else {
		console.warn('app.commandLine not available');
	}
} catch (error) {
	console.error('Failed to set app command line switches:', error);
}

// Handle app events
if (app && typeof app.whenReady === 'function') {
	app.whenReady().then(async () => {
		try {
			log.info('App is ready');

			// Initialize electron-store
			try {
				store = new Store();
				log.info('Electron store initialized successfully');
			} catch (error) {
				log.error('Failed to initialize electron store:', error);
			}

			// Initialize app-specific configurations that require app to be ready
			initializeAppConfiguration();

			// Initialize MCP Server FIRST, before creating the window
			try {
				log.info('Initializing MCP Server...');
				mcpServerManager = new McpServerManager(environment);

				const started = await mcpServerManager.start();
				isServerInitialized = started;

				if (started) {
					const status = mcpServerManager.getStatus();
					log.info(
						`MCP Server started successfully - Version: ${status.version}, Transport: ${
							status.transport
						}, URL: ${status.url || 'N/A'}`
					);
				} else {
					log.warn('MCP Server failed to start properly');
				}
			} catch (error) {
				log.error('Failed to start MCP Server:', error);
				isServerInitialized = false;
				// Still create the window so user can see the error and try to restart
			}

			// Create window AFTER server is initialized
			await createMainWindow();
		} catch (error) {
			log.error('Error during app initialization:', error);
		}
	});
} else {
	console.error('Electron app is not available - this should only run in an Electron environment');
	process.exit(1);
}

function initializeAppConfiguration(): void {
	// Set app-specific configurations that require app to be ready
	try {
		// Set app name
		app.setName(environment.mcpAppName);

		/* Setting the app user model id for the app. */
		if (process.platform === 'win32') {
			app.setAppUserModelId(environment.appId);
		}

		// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
		process.env.GAUZY_USER_PATH = app.getPath('userData');
		log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);
	} catch (error) {
		log.error('Error initializing app configuration:', error);
	}
}

if (app && typeof app.on === 'function') {
	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin' && app && typeof app.quit === 'function') {
			app.quit();
		}
	});

	app.on('activate', async () => {
		if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) {
			await createMainWindow();
		} else if (mainWindow) {
			// If window exists but is hidden, show it
			mainWindow.show();
			mainWindow.focus();
		}
	});

	app.on('before-quit', async () => {
		if (mcpServerManager) {
			await mcpServerManager.stop();
		}
	});
}

// Function to notify renderer about server status changes
function notifyServerStatusUpdate(): void {
	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.webContents.send('server-status-update');
	}
}

async function createMainWindow(): Promise<void> {
	// Debug path information
	const currentDir = process.cwd();
	const appPath = app.getAppPath();

	// Try to find the correct paths for built files
	let actualAppPath: string;
	let preloadPath: string;
	let htmlPath: string;

	// Check if we're in development or production
	const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';

	if (isDev) {
		// In development, use the built files from dist
		actualAppPath = path.join(currentDir, 'dist', 'apps', 'server-mcp');
		preloadPath = path.join(actualAppPath, 'preload', 'preload.js');
		htmlPath = path.join(actualAppPath, 'static', 'index.html');
	} else {
		// In production, use app path
		actualAppPath = appPath;
		preloadPath = path.join(actualAppPath, 'preload', 'preload.js');
		htmlPath = path.join(actualAppPath, 'static', 'index.html');
	}

	// Verify files exist and provide fallbacks
	const fs = require('fs');
	if (!fs.existsSync(preloadPath)) {
		// When running from source maps/ts, webpack places compiled files next to this file at ../../dist/apps/server-mcp
		const altPreloadPath = path.join(appPath, 'preload', 'preload.js');
		if (fs.existsSync(altPreloadPath)) {
			preloadPath = altPreloadPath;
		} else {
			const msg = `Preload script not found at ${preloadPath} or ${altPreloadPath}`;
			log.error(msg);
			throw new Error(msg);
		}
	}

	if (!fs.existsSync(htmlPath)) {
		const altHtmlPath = path.join(__dirname, '..', 'static', 'index.html');
		if (fs.existsSync(altHtmlPath)) {
			htmlPath = altHtmlPath;
		} else {
			const msg = `HTML file not found at ${htmlPath} or ${altHtmlPath}`;
			log.error(msg);
			throw new Error(msg);
		}
	}

	log.debug('Main: __dirname =', __dirname);
	log.debug('Main: process.cwd() =', currentDir);
	log.debug('Main: app.getAppPath() =', appPath);
	log.debug('Main: actualAppPath =', actualAppPath);
	log.debug('Main: preloadPath =', preloadPath);
	log.debug('Main: htmlPath =', htmlPath);
	log.debug('Main: preloadExists =', fs.existsSync(preloadPath));
	log.debug('Main: htmlExists =', fs.existsSync(htmlPath));

	// Create an enhanced status window for the MCP server
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 600,
		minHeight: 400,
		show: false,
		title: 'Gauzy MCP Server Desktop',
		icon: process.platform === 'darwin'
			? path.join(actualAppPath, 'icons', 'app.icns')
			: process.platform === 'win32'
			? path.join(actualAppPath, 'icons', 'app.ico')
			: path.join(actualAppPath, 'icons', 'app.png'),
		center: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: preloadPath,
			webSecurity: true,
			backgroundThrottling: false,
			experimentalFeatures: false,
			devTools: securityConfig.getEnvironmentRules().allowDevTools,
			allowRunningInsecureContent: false,
			safeDialogs: true,
			safeDialogsMessage: 'This app is trying to display a dialog'
		}
	});

	// Setup IPC handlers BEFORE loading the HTML
	setupIpcHandlers();

	// Load the enhanced HTML file
	await mainWindow.loadFile(htmlPath);

	// Suppress DevTools console errors
	mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
		// Filter out known DevTools errors
		if (
			message.includes('Autofill.enable') ||
			message.includes('Failed to fetch') ||
			sourceId.includes('devtools://')
		) {
			// Silently ignore these DevTools errors
			return;
		}
		// Log other console messages normally
		if (level >= 2) {
			// 2 = warning, 3 = error
			log.warn(`Console ${level === 3 ? 'error' : 'warning'}: ${message}`);
		}
	});

	// Only open DevTools in development and handle errors gracefully
	if (!environment.production && environment.debug) {
		mainWindow.webContents.once('dom-ready', () => {
			try {
				// Add a small delay to ensure the window is fully loaded
				setTimeout(() => {
					if (mainWindow && !mainWindow.isDestroyed()) {
						mainWindow.webContents.openDevTools({ mode: 'bottom' });
					}
				}, 1000);
			} catch (error) {
				log.warn('Failed to open DevTools:', error);
			}
		});
	}

	// Show window when ready
	mainWindow.once('ready-to-show', () => {
		if (mainWindow) {
			mainWindow.show();
			mainWindow.focus();
			if (process.platform === 'darwin') {
				app.dock.show();
			}
		}
	});

	// Handle window closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Handle external links
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	// Window management handlers
	if (ipcMain && typeof ipcMain.on === 'function') {
		ipcMain.on('expand_window', () => {
			if (mainWindow && !mainWindow.isDestroyed()) {
				try {
					if (mainWindow.isMaximized()) {
						mainWindow.unmaximize();
					} else {
						mainWindow.maximize();
					}
				} catch (error) {
					log.error('Error expanding/contracting window:', error);
				}
			}
		});
	}
}

function setupIpcHandlers(): void {
	if (!ipcMain || typeof ipcMain.handle !== 'function') {
		log.error('IPC Main not available');
		return;
	}

	// IPC handlers for MCP server status
	ipcMain.handle('get-mcp-status', async () => {
		log.info('IPC: get-mcp-status handler called');
		try {
			if (!mcpServerManager) {
				log.warn('IPC: McpServerManager not initialized');
				return {
					isRunning: false,
					status: 'Not initialized',
					version: 'Unknown',
					port: null,
					transport: null,
					url: null,
					uptime: null,
					initialized: false,
					connectionString: 'No connection',
					error: 'Server manager not initialized'
				};
			}

			const statusData = mcpServerManager.getStatus();
			log.info('IPC: Got status data:', {
				running: statusData.running,
				version: statusData.version,
				transport: statusData.transport,
				initialized: statusData.initialized
			});

			const result = {
				isRunning: statusData.running,
				status: statusData.running ? 'Running' : statusData.initialized ? 'Stopped' : 'Not initialized',
				version: statusData.version,
				port: statusData.port,
				transport: statusData.transport,
				url: statusData.url,
				uptime: statusData.uptime,
				initialized: statusData.initialized,
				connectionString: statusData.connectionString,
				error: statusData.lastError
			};

			const { connectionString, ...safe } = result as any;
			log.info('IPC: Returning status result:', safe);
			return result;
		} catch (error) {
			log.error('Error getting MCP status:', error);
			const errorResult = {
				isRunning: false,
				status: 'Error',
				version: 'Unknown',
				port: null,
				transport: null,
				url: null,
				uptime: null,
				initialized: false,
				connectionString: 'Error',
				error: error.message || 'Unknown error'
			};
			log.error('IPC: Returning error result:', errorResult);
			return errorResult;
		}
	});

	ipcMain.handle('restart-mcp-server', async () => {
		if (!mcpServerManager) {
			return { success: false, message: 'MCP Server not initialized' };
		}

		try {
			log.info('Restarting MCP Server...');
			await mcpServerManager.restart();
			isServerInitialized = true;
			log.info('MCP Server restarted successfully');

			// Notify renderer about the status change
			notifyServerStatusUpdate();

			return { success: true, message: 'MCP Server restarted successfully' };
		} catch (error) {
			log.error('Failed to restart MCP Server:', error);
			isServerInitialized = false;
			return { success: false, message: `Failed to restart: ${error.message || error}` };
		}
	});

	// Additional IPC handlers for app functionality
	ipcMain.handle('get-app-version', () => {
		try {
			return app.getVersion();
		} catch (error) {
			log.error('Error getting app version:', error);
			return 'Unknown';
		}
	});

	ipcMain.handle('get-saved-theme', () => {
		try {
			return store ? store.get('theme', 'default') : 'default';
		} catch (error) {
			log.error('Error getting saved theme:', error);
			return 'default';
		}
	});

	ipcMain.handle('save-theme', (_, theme: string) => {
		try {
			if (store) {
				store.set('theme', theme);
				return true;
			}
			return false;
		} catch (error) {
			log.error('Error saving theme:', error);
			return false;
		}
	});

	// Handler to check if server is ready
	ipcMain.handle('is-server-ready', () => {
		return isServerInitialized && mcpServerManager !== null;
	});
}
