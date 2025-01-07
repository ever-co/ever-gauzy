import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, store } from '@gauzy/desktop-core';
import { handleCloseEvent, setLaunchPathAndLoad } from './utils/desktop-window-utils';

/**
 * Creates and configures the Image Viewer window in the Electron application.
 *
 * @param {Electron.BrowserWindow | null} imageViewWindow - The reference to the Image Viewer window instance (can be null initially).
 * @param {string} filePath - The file path to the HTML file for the Image Viewer window.
 * @param {string} [preloadPath] - An optional path to the preload script for the window.
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured Image Viewer window instance.
 *
 * @example
 * const imageViewWindow = await createImageViewerWindow(null, '/path/to/viewer.html', '/path/to/preload.js');
 */
export async function createImageViewerWindow(
	imageViewWindow: Electron.BrowserWindow | null,
	filePath: string,
	preloadPath?: string
): Promise<Electron.BrowserWindow> {
	// Get the WindowManager instance for managing windows
	const manager = WindowManager.getInstance();

	// Retrieve the main window settings, passing in the optional preload path
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);

	// Create the BrowserWindow for the Image Viewer
	imageViewWindow = new BrowserWindow(mainWindowSettings);

	// Enable remote functionality for the window
	remoteMain.enable(imageViewWindow.webContents);

	// Hide the window initially
	imageViewWindow.hide();

	// Use the helper function to construct and load the URL
	await setLaunchPathAndLoad(imageViewWindow, filePath, '/viewer');

	// Remove the menu from the window
	imageViewWindow.setMenu(null);

	// Optional: Uncomment to open Developer Tools
	// imageViewWindow.webContents.toggleDevTools();

	// Attach the close event handler
	handleCloseEvent(imageViewWindow);

	// Register the Image Viewer window with the WindowManager
	manager.register(RegisteredWindow.IMAGE_VIEWER, imageViewWindow);

	// Attach a custom title bar if a preload script is provided
	if (preloadPath) {
		attachTitlebarToWindow(imageViewWindow);
	}

	// Return the configured Image Viewer window instance
	return imageViewWindow;
}

/**
 * Generates and returns configuration settings for an Electron BrowserWindow.
 * Allows customization through a preload script path.
 *
 * @param {string} [preloadPath] - Optional path to the preload script. Enables additional settings like `titleBarStyle` and `preload`.
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
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			contextIsolation: false,
			sandbox: false
		},
		width: 1000,
		height: 728,
		title: '',
		maximizable: true,
		show: false
	};

	// Fetch the icon path from the application's store
	const filesPath = store.get('filePath');
	if (filesPath?.iconPath) {
		mainWindowSettings.icon = filesPath.iconPath;
	}

	// Additional settings when a preload script is provided
	if (preloadPath) {
		mainWindowSettings.titleBarStyle = 'hidden';
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.webPreferences.preload = preloadPath;

		// Platform-specific adjustments
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}

	return mainWindowSettings;
};
