import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, store } from '@gauzy/desktop-core';
import { handleCloseEvent, setLaunchPathAndLoad } from './utils/desktop-window-utils';

/**
 * Creates and configures the server dashboard window in the Electron application.
 *
 * @param {Electron.BrowserWindow | null} serverWindow - The reference to the server window instance (can be null initially).
 * @param {object} config - The configuration options for the server window.
 * @param {string} filePath - The file path to the HTML file for the server window.
 * @param {string} [preloadPath] - An optional path to the preload script for the window.
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured server window instance.
 *
 * @example
 * const serverWindow = await createServerWindow(null, {}, '/path/to/server.html', '/path/to/preload.js');
 */
export async function createServerWindow(
	serverWindow: Electron.BrowserWindow | null,
	filePath: string,
	preloadPath?: string
): Promise<Electron.BrowserWindow> {
	// Retrieve the window settings using the optional preload script
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);

	// Get the WindowManager instance for managing windows
	const manager = WindowManager.getInstance();

	// Create a new BrowserWindow for the server dashboard
	serverWindow = new BrowserWindow(mainWindowSettings);

	// Enable remote functionality for the server window
	remoteMain.enable(serverWindow.webContents);

	// Use the helper function to construct and load the URL
	await setLaunchPathAndLoad(serverWindow, filePath, '/server-dashboard');

	// Optional: Uncomment to open Developer Tools
	// serverWindow.webContents.toggleDevTools();

	// Attach the reusable close event handler
	handleCloseEvent(serverWindow);

	// Attach a custom title bar if a preload script is provided
	if (preloadPath) {
		attachTitlebarToWindow(serverWindow);
	}

	// Register the server window with the WindowManager
	manager.register(RegisteredWindow.SERVER, serverWindow);

	// Return the configured server window instance
	return serverWindow;
}

/**
 * Generates and returns configuration settings for an Electron BrowserWindow.
 * Allows customization through an optional preload script path.
 *
 * @param {string} [preloadPath] - Optional path to the preload script. If provided, enables additional settings.
 *
 * @returns {Electron.BrowserWindowConstructorOptions} The configuration object for creating a BrowserWindow.
 *
 * @example
 * const settings = windowSetting('/path/to/preload.js');
 * const mainWindow = new BrowserWindow(settings);
 */
const windowSetting = (preloadPath?: string): Electron.BrowserWindowConstructorOptions => {
	// Default settings for the main application window
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: 380,
		height: 400,
		title: process.env.DESCRIPTION || '',
		show: false,
		center: true
	};

	// Apply additional settings if a preload script is provided
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarStyle = 'hidden';
		mainWindowSettings.titleBarOverlay = true;

		// Platform-specific adjustments for Linux
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}

	// Retrieve the icon path from the application's store and assign it
	const filesPath = store.get('filePath');
	if (filesPath?.iconPath) {
		mainWindowSettings.icon = filesPath.iconPath;
	}

	return mainWindowSettings;
};
