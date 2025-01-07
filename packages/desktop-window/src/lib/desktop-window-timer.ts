import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, screen } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, store } from '@gauzy/desktop-core';
import { handleCloseEvent, setLaunchPathAndLoad } from './utils/desktop-window-utils';
/**
 * Creates and configures the Time Tracker window in the Electron application.
 *
 * @param {Electron.BrowserWindow} timeTrackerWindow - The variable to hold the reference to the Time Tracker window.
 * @param {string} filePath - The file path to the HTML file for the Time Tracker window.
 * @param {string} [preloadPath] - The path to the preload script (optional).
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured Time Tracker window instance.
 *
 * @example
 * const timeTrackerWindow = await createTimeTrackerWindow(null, '/path/to/file.html', '/path/to/preload.js');
 */
export async function createTimeTrackerWindow(
	timeTrackerWindow: Electron.BrowserWindow,
	filePath: string,
	preloadPath?: string
): Promise<Electron.BrowserWindow> {
	// Get window settings based on the optional preload path
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);

	// Get the instance of the WindowManager
	const manager = WindowManager.getInstance();

	// Create a new BrowserWindow for the Time Tracker
	timeTrackerWindow = new BrowserWindow(mainWindowSettings);

	// Enable remote functionality for the window
	remoteMain.enable(timeTrackerWindow.webContents);

	// Hide the window initially
	timeTrackerWindow.hide();

	// Load the Time Tracker page using the helper function
	await setLaunchPathAndLoad(timeTrackerWindow, filePath, '/time-tracker');

	// Attach the custom title bar if a preload script is provided
	if (preloadPath) {
		attachTitlebarToWindow(timeTrackerWindow);
	}

	// Set the minimum size for the window
	const { width, height } = getScreenSize();
	timeTrackerWindow.setMinimumSize(width, height);

	// Remove the menu from the window
	timeTrackerWindow.setMenu(null);

	// Attach the close event handler
	handleCloseEvent(timeTrackerWindow);

	// Register the Time Tracker window with the WindowManager
	manager.register(RegisteredWindow.TIMER, timeTrackerWindow);

	// Return the configured Time Tracker window instance
	return timeTrackerWindow;
}

/**
 * Generates the settings for the main Electron BrowserWindow.
 *
 * @param {string} [preloadPath] - Optional path to the preload script. If provided,
 * additional settings such as `titleBarStyle`, `titleBarOverlay`, and `preload` are applied.
 *
 * @returns {Electron.BrowserWindowConstructorOptions} The configuration object for creating a BrowserWindow.
 *
 * @example
 * const settings = windowSetting('/path/to/preload.js');
 * const mainWindow = new BrowserWindow(settings);
 */
const windowSetting = (preloadPath?: string): Electron.BrowserWindowConstructorOptions => {
	// Get the work area size of the primary display
	const sizes = screen.getPrimaryDisplay().workAreaSize;

	// Get screen dimensions from a custom utility
	const { width, height } = getScreenSize();
	console.log(`width: ${width}, height: ${height}`);

	// Determine the zoom factor based on screen height
	const zoomFactor = sizes.height < 768 ? 0.8 : 1.0;

	// Retrieve file paths from the application store
	const filesPath = store.get('filePath');
	console.log(`File Path: ${filesPath}`);

	// Default settings for the main window
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			zoomFactor: zoomFactor,
			sandbox: false
		},
		width: width,
		height: height,
		title: process.env.DESCRIPTION || 'Time Tracker',
		maximizable: false,
		show: false,
		icon: filesPath.iconPath
	};

	// Additional settings if a preload path is provided
	if (preloadPath) {
		mainWindowSettings.titleBarStyle = 'hidden';
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.webPreferences.preload = preloadPath;

		// Adjust frame settings for Linux
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}

	// Return the final settings object
	return mainWindowSettings;
};

/**
 * Calculates the optimal screen size for the application window based on the
 * primary display's work area size.
 *
 * @returns {{ width: number, height: number }} An object containing the calculated
 * width and height for the application window.
 *
 * @example
 * const { width, height } = getScreenSize();
 * console.log(`Width: ${width}, Height: ${height}`);
 */
function getScreenSize(): { width: number; height: number } {
	// Get the work area size of the primary display
	const sizes = screen.getPrimaryDisplay().workAreaSize;

	// Determine the width and height based on screen height
	const width = sizes.height < 768 ? 310 : 360;
	const height = sizes.height < 768 ? sizes.height - 20 : 768;

	// Return the calculated dimensions
	return { width, height };
}

/**
 * Constructs a URL for the login page with the specified file path.
 *
 * @param {string} filePath - The file path to the base HTML file for the login page.
 *
 * @returns {string} The formatted URL pointing to the login page.
 */
export function loginPage(filePath: string): string {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/auth/login'
	});
}

/**
 * Constructs a URL for the time tracker page with the specified file path.
 *
 * @param {string} filePath - The file path to the base HTML file for the time tracker page.
 *
 * @returns {string} The formatted URL pointing to the time tracker page.
 */
export function timeTrackerPage(filePath: string): string {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/time-tracker'
	});
}
