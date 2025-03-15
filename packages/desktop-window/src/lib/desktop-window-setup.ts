import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, Menu, app } from 'electron';
import { WindowManager, RegisteredWindow, store } from '@gauzy/desktop-core';
import { handleCloseEvent, setLaunchPathAndLoad } from './utils/desktop-window-utils';

/**
 * Creates and configures the Setup window in the Electron application.
 *
 * @param {Electron.BrowserWindow | null} setupWindow - The variable to hold the reference to the Setup window instance.
 * @param {boolean} value - Determines whether the window should initially be hidden.
 * @param {string} filePath - The file path to the HTML file for the Setup window.
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured Setup window instance.
 *
 * @example
 * const setupWindow = await createSetupWindow(null, true, '/path/to/file.html');
 */
export async function createSetupWindow(
	setupWindow: Electron.BrowserWindow | null,
	value: boolean,
	filePath: string,
	preloadPath?: string,
	contextIsolation?: boolean
): Promise<Electron.BrowserWindow> {
	// Retrieve the window configuration settings
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath, contextIsolation);

	// Get the WindowManager instance for managing application windows
	const manager = WindowManager.getInstance();

	// Create a new BrowserWindow instance
	setupWindow = new BrowserWindow(mainWindowSettings);

	// Enable remote functionality for the Setup window
	remoteMain.enable(setupWindow.webContents);

	// Hide the window if the `value` parameter is true
	if (value) {
		setupWindow.hide();
	}

	// Use the helper function to construct and load the URL
	await setLaunchPathAndLoad(setupWindow, filePath, '/setup');

	// Configure the menu for the Setup window
	setupWindow.setMenu(
		Menu.buildFromTemplate([
			{
				label: app.getName(),
				submenu: [{ role: 'quit', label: 'Exit' }]
			}
		])
	);

	// Optional: Uncomment the next line to open Developer Tools
	// setupWindow.webContents.toggleDevTools();

	// Attach the close event handler
	handleCloseEvent(setupWindow);

	// Register the Setup window with the WindowManager
	manager.register(RegisteredWindow.SETUP, setupWindow);

	// Return the configured Setup window instance
	return setupWindow;
}

/**
 * Generates and returns configuration settings for an Electron BrowserWindow.
 * These settings define the behavior and appearance of the main application window.
 *
 * @returns {Electron.BrowserWindowConstructorOptions} The configuration object for creating a BrowserWindow.
 *
 * @example
 * const settings = windowSetting();
 * const mainWindow = new BrowserWindow(settings);
 */
const windowSetting = (preloadPath?: string, contextIsolation?: boolean): Electron.BrowserWindowConstructorOptions => {
	// Default settings for the main application window
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: 960,
		height: 680,
		title: 'Setup',
		autoHideMenuBar: true,
		maximizable: false,
		show: false
	};

	if (contextIsolation) {
		mainWindowSettings.webPreferences.contextIsolation = true;
		mainWindowSettings.webPreferences.nodeIntegration = false;
		mainWindowSettings.webPreferences.preload = preloadPath;
	}

	// Fetch the icon path from the application's store
	const filesPath = store.get('filePath');
	if (filesPath?.iconPath) {
		mainWindowSettings.icon = filesPath.iconPath;
	}

	return mainWindowSettings;
};
