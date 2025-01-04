import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, ipcMain, screen } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, store } from '@gauzy/desktop-core';
import { handleCloseEvent } from './utils/desktop-window-utils';

/**
 * Creates and initializes the Gauzy main window for the Electron application.
 *
 * This function sets up a new Electron `BrowserWindow` instance with the specified settings,
 * loads the appropriate URL or file path, and attaches listeners for close and IPC events.
 * It also registers the window with the `WindowManager` for centralized control.
 *
 * @param {Electron.BrowserWindow | null} gauzyWindow - The Gauzy window instance to initialize or recreate.
 * @param {boolean} serve - Indicates if the application is running in development mode (serve).
 * @param {object} config - The configuration object containing app-specific settings.
 * @param {string} filePath - The path to the local file to load if not in serve mode.
 * @param {string} [preloadPath] - An optional path to the preload script for the window.
 * @returns {Promise<Electron.BrowserWindow>} - A promise resolving to the initialized Gauzy window.
 */
export async function createGauzyWindow(
	gauzyWindow: Electron.BrowserWindow | null,
	serve: boolean,
	config: any,
	filePath: string,
	preloadPath?: string
): Promise<Electron.BrowserWindow> {
	console.info('Creating Gauzy main window: Initialization process started');
	// Get the WindowManager instance
	const manager = WindowManager.getInstance();

	// Define window settings
	const mainWindowSettings = windowSetting(preloadPath);

	// Create a new BrowserWindow instance
	gauzyWindow = new BrowserWindow(mainWindowSettings);

	// Enable remote handling for the window
	remoteMain.enable(gauzyWindow.webContents);

	// Hide the window if configured to do so in the config
	hideWindowIfConfigured(gauzyWindow, config);

	let launchPath: string;
	// Load the appropriate URL or file path
	if (serve) {
		const electronPath = require(`${__dirname}/../../../../node_modules/electron`);
		require('electron-reload')(__dirname, { electron: electronPath });

		launchPath = `http://localhost:${config.GAUZY_UI_DEFAULT_PORT}`;
		await gauzyWindow.loadURL(launchPath);
	} else {
		launchPath = await setLaunchPathAndLoad(gauzyWindow, filePath);
	}

	console.log('Launched Electron with:', launchPath);

	// Handle close event
	handleCloseEvent(gauzyWindow);

	// Init main listener for electron
	initMainListener();

	console.info('Gauzy main window creation completed successfully');

	// Register the window with the WindowManager
	manager.register(RegisteredWindow.MAIN, gauzyWindow);

	// Additional configuration for preloadPath
	if (preloadPath) {
		attachTitlebarToWindow(gauzyWindow);
		gauzyWindow.webContents.send('adjust_view');
	}

	// Return the created window
	return gauzyWindow;
}

/**
 * Conditionally hides the Gauzy window based on the configuration.
 *
 * If the `gauzyWindow` property in the `config` object is falsy, this function
 * hides the provided `BrowserWindow` instance.
 *
 * @param {Electron.BrowserWindow} gauzyWindow - The window to be hidden.
 * @param {{ gauzyWindow?: string }} config - Configuration with an optional `gauzyWindow` property.
 */
function hideWindowIfConfigured(gauzyWindow: Electron.BrowserWindow, config: { gauzyWindow?: string }): void {
	if (!config.gauzyWindow) {
		gauzyWindow.hide();
	}
}

/**
 * Sets the launch path for the Gauzy window and loads the specified URL.
 *
 * This function constructs a `file:` protocol URL using the provided file path and
 * loads it into the Electron `BrowserWindow` instance.
 *
 * @param {Electron.BrowserWindow} window - The BrowserWindow instance to load the URL into.
 * @param {string} filePath - The local file path to be loaded into the window.
 * @returns {Promise<void>} - Resolves when the URL is successfully loaded.
 */
async function setLaunchPathAndLoad(window: Electron.BrowserWindow, filePath: string): Promise<string> {
	// Construct the file URL
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true
	});

	// Load the constructed URL into the BrowserWindow
	await window.loadURL(launchPath);

	// Log the loaded URL for debugging purposes
	console.info(`Loaded URL in Gauzy window: ${launchPath}`);
	return launchPath;
}

/**
 * Generates configuration settings for the main Electron BrowserWindow.
 *
 * This function creates a configuration object for initializing a BrowserWindow,
 * setting properties such as size, position, and web preferences. It also applies
 * platform-specific settings when necessary.
 *
 * @param {string | undefined} preloadPath - The path to the preload script for the BrowserWindow. If not provided, preload-related settings are excluded.
 * @returns {Electron.BrowserWindowConstructorOptions} - The configuration object for the BrowserWindow.
 */
const windowSetting = (preloadPath?: string): Electron.BrowserWindowConstructorOptions => {
	// Retrieve the screen size and file paths
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const filesPath = store.get('filePath');

	// Define the base settings for the BrowserWindow
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: sizes.width,
		height: sizes.height,
		x: 0,
		y: 0,
		title: process.env.DESCRIPTION || 'Gauzy Desktop',
		show: false,
		icon: filesPath.iconPath
	};

	// Apply additional settings if preloadPath is provided
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath; // Set the preload script
		mainWindowSettings.titleBarOverlay = true; // Enable title bar overlay
		mainWindowSettings.titleBarStyle = 'hidden'; // Hide the default title bar

		// Adjust settings for Linux platform
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false; // Disable the window frame
		}
	}

	// Return the configured settings
	return mainWindowSettings;
};

/**
 * Initializes the main IPC listener for Electron's message bridge.
 *
 * Listens for the `ELECTRON_BRIDGE_HOST` event from the renderer process.
 * Responds with a `pong` message when a `ping` message is received.
 */
function initMainListener(): void {
	ipcMain.on('ELECTRON_BRIDGE_HOST', (event, msg) => {
		console.log('Message received from renderer:', msg);

		// Respond with 'pong' if the message is 'ping'
		if (msg === 'ping') {
			event.sender.send('ELECTRON_BRIDGE_CLIENT', 'pong');
		}
	});
}

/**
 * Gets the API base URL from configurations or defaults to localhost.
 *
 * @param {object} configs - Configurations with optional `serverUrl` or `port`.
 * @param {object} envConfig - Environment configurations with `API_DEFAULT_PORT`.
 * @returns {string} - The API base URL.
 */
export function getApiBaseUrl(
	configs: { serverUrl?: string; port?: number },
	envConfig: { API_DEFAULT_PORT: number }
): string {
	return configs.serverUrl || `http://localhost:${configs.port || envConfig.API_DEFAULT_PORT}`;
}
