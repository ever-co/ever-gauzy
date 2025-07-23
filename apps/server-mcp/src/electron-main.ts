// Import logging for electron and override default console logging (CommonJS module)
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, BrowserWindow, shell, ipcMain, Menu, Tray, nativeImage, dialog, nativeTheme, screen } from 'electron';
import type { BrowserWindow as BrowserWindowType, Tray as TrayType } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import titlebarPkg from 'custom-electron-titlebar/main';
const { setupTitlebar } = titlebarPkg;

// Import environment
import { environment } from '@gauzy/mcp-server';

// Import electron-store (CommonJS module)
import Store from 'electron-store';

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

let mainWindow: BrowserWindowType | null = null;
let tray: TrayType | null = null;
let mcpServerManager: McpServerManager | null = null;
const store = new Store();

// Only set specific environment variables that are needed
if (environment.baseUrl) process.env.API_BASE_URL = environment.baseUrl;
if (environment.apiTimeout) process.env.API_TIMEOUT = String(environment.apiTimeout);
if (environment.debug !== undefined) process.env.GAUZY_MCP_DEBUG = String(environment.debug);

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

// Set app name
app.setName(environment.mcpAppName);

/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(environment.appId);
}

// Set unlimited listeners
ipcMain.setMaxListeners(0);

// Handle app events
app.whenReady().then(async () => {
	try {
		log.info('App is ready');

		await createMainWindow();
		setupApplicationMenu();
		setupTray();

		// Initialize MCP Server
		try {
			mcpServerManager = new McpServerManager(environment);
			await mcpServerManager.start();
			log.info('MCP Server started successfully');
		} catch (error) {
			log.error('Failed to start MCP Server:', error);
		}

		// Setup auto-updater event listeners
		setupAutoUpdater();

		// Handle auto-updater
		if (environment.production) {
			autoUpdater.checkForUpdatesAndNotify();
		}
	} catch (error) {
		log.error('Error during app initialization:', error);
	}
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', async () => {
	if (BrowserWindow.getAllWindows().length === 0) {
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

// Set security settings
app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('in-process-gpu');

// Fix DevTools autofill and console errors
app.commandLine.appendSwitch('disable-features', 'Autofill');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

async function createMainWindow(): Promise<void> {
	// Create an enhanced status window for the MCP server
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 600,
		minHeight: 400,
		show: false,
		title: 'Gauzy MCP Server Desktop',
		icon: path.join(__dirname, 'favicon.ico'),
		center: true,
		alwaysOnTop: false,
		skipTaskbar: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload', 'preload.js'),
			webSecurity: true,
			backgroundThrottling: false,
			experimentalFeatures: false,
			devTools: securityConfig.getEnvironmentRules().allowDevTools,
			allowRunningInsecureContent: false,
			safeDialogs: true,
			safeDialogsMessage: 'This app is trying to display a dialog'
		}
	});

	// Load the enhanced HTML file
	const htmlPath = path.join(__dirname, 'static', 'index.html');
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

	// IPC handlers for MCP server status
	ipcMain.handle('get-mcp-status', async () => {
		if (mcpServerManager) {
			return {
				isRunning: mcpServerManager.isRunning(),
				status: mcpServerManager.getStatus(),
				version: mcpServerManager.getVersion()
			};
		}
		return { isRunning: false, status: 'Not initialized', version: 'Unknown' };
	});

	ipcMain.handle('restart-mcp-server', async () => {
		if (mcpServerManager) {
			try {
				await mcpServerManager.restart();
				return { success: true, message: 'MCP Server restarted successfully' };
			} catch (error) {
				return { success: false, message: `Failed to restart: ${error}` };
			}
		}
		return { success: false, message: 'MCP Server not initialized' };
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
			return store.get('theme', 'default');
		} catch (error) {
			log.error('Error getting saved theme:', error);
			return 'default';
		}
	});

	ipcMain.handle('save-theme', (_, theme: string) => {
		try {
			store.set('theme', theme);
			return true;
		} catch (error) {
			log.error('Error saving theme:', error);
			return false;
		}
	});
}

function setupApplicationMenu(): void {
	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: 'File',
			submenu: [
				{
					label: 'New Window',
					accelerator: 'CmdOrCtrl+N',
					click: async () => {
						await createMainWindow();
					}
				},
				{ type: 'separator' },
				{
					label: 'Quit',
					accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
					click: () => {
						app.quit();
					}
				}
			]
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'selectAll' }
			]
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' }
			]
		},
		{
			label: 'MCP Server',
			submenu: [
				{
					label: 'Restart Server',
					accelerator: 'CmdOrCtrl+R',
					click: async () => {
						if (mcpServerManager) {
							try {
								await mcpServerManager.restart();
								log.info('MCP Server restarted successfully');
							} catch (error) {
								log.error('Failed to restart MCP Server:', error);
							}
						}
					}
				},
				{
					label: 'Server Status',
					click: async () => {
						if (mcpServerManager) {
							const status = mcpServerManager.getStatus();
							const parentWindow = mainWindow || undefined;
							dialog.showMessageBox(parentWindow, {
								type: 'info',
								title: 'MCP Server Status',
								message: `Server Status: ${status}`,
								detail: `Version: ${mcpServerManager.getVersion()}\nRunning: ${mcpServerManager.isRunning()}`
							});
						}
					}
				}
			]
		},
		{
			label: 'Window',
			submenu: [{ role: 'minimize' }, { role: 'close' }]
		},
		{
			role: 'help',
			submenu: [
				{
					label: 'About Gauzy MCP Server',
					click: () => {
						const parentWindow = mainWindow || undefined;
						dialog.showMessageBox(parentWindow, {
							type: 'info',
							title: 'About Gauzy MCP Server',
							message: 'Gauzy MCP Server Desktop',
							detail: `Version: ${app.getVersion()}\n\nA Model Context Protocol server providing AI assistants with access to Gauzy's time tracking, project, and employee management features.`
						});
					}
				}
			]
		}
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

function setupTray(): void {
	// Create tray icon
	const iconPath = path.join(__dirname, 'favicon.ico');
	const icon = nativeImage.createFromPath(iconPath);

	// Resize icon for tray (16x16 or 32x32 depending on platform)
	const trayIcon = icon.resize({ width: 16, height: 16 });
	trayIcon.setTemplateImage(process.platform === 'darwin');

	tray = new Tray(trayIcon);
	tray.setToolTip('Gauzy MCP Server');

	// Create tray menu
	const trayMenu = Menu.buildFromTemplate([
		{
			label: 'Show App',
			click: () => {
				if (mainWindow) {
					mainWindow.show();
					mainWindow.focus();
				}
			}
		},
		{
			label: 'MCP Server Status',
			click: async () => {
				if (mcpServerManager) {
					const status = mcpServerManager.getStatus();
					const parentWindow = mainWindow || undefined;
					dialog.showMessageBox(parentWindow, {
						type: 'info',
						title: 'MCP Server Status',
						message: `Server Status: ${status}`,
						detail: `Version: ${mcpServerManager.getVersion()}\nRunning: ${mcpServerManager.isRunning()}`
					});
				}
			}
		},
		{ type: 'separator' },
		{
			label: 'Quit',
			click: () => {
				app.quit();
			}
		}
	]);

	tray.setContextMenu(trayMenu);

	// Handle tray click
	tray.on('click', () => {
		if (mainWindow) {
			if (mainWindow.isVisible()) {
				mainWindow.hide();
			} else {
				mainWindow.show();
				mainWindow.focus();
			}
		}
	});
}

function setupAutoUpdater(): void {
	autoUpdater.on('checking-for-update', () => {
		log.info('Checking for update...');
	});

	autoUpdater.on('update-available', (info) => {
		log.info('Update available:', info);
	});

	autoUpdater.on('update-not-available', (info) => {
		log.info('Update not available:', info);
	});

	autoUpdater.on('error', (err) => {
		log.error('AutoUpdater error:', err);
	});

	autoUpdater.on('download-progress', (progressObj) => {
		log.info('Download progress:', progressObj);
	});

	autoUpdater.on('update-downloaded', (info) => {
		log.info('Update downloaded:', info);
		dialog.showMessageBox(mainWindow || undefined, {
			type: 'info',
			title: 'Update Available',
			message: 'A new version has been downloaded. Restart now to apply the update?',
			buttons: ['Restart', 'Later']
		}).then((result) => {
			if (result.response === 0) {
				autoUpdater.quitAndInstall();
			}
		});
	});
}
