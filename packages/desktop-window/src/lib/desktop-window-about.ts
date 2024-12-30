import * as remoteMain from '@electron/remote/main';
import { WindowManager, RegisteredWindow, Store } from '@gauzy/desktop-core';
import { BrowserWindow, Menu } from 'electron';
import * as url from 'url';

/**
 * Creates or shows the 'About' window for the application.
 *
 * This function checks if an 'About' window already exists. If it does, the window is shown.
 * Otherwise, it creates a new 'About' window using specified settings and registers it
 * with the window manager. The function also sets up event listeners for window actions.
 *
 * @param {string} filePath - The file path to load in the 'About' window.
 * @param {string | undefined} [preloadPath] - Optional path to the preload script for the 'About' window.
 * @returns {Promise<Electron.BrowserWindow>} - The created or shown BrowserWindow instance.
 */
export async function createAboutWindow(filePath: string, preloadPath?: string): Promise<Electron.BrowserWindow> {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	// Check if an 'About' window already exists and show it
	const allWindows = BrowserWindow.getAllWindows();
	const aboutWindow = allWindows.find((win) => win.getTitle() === 'About');
	if (aboutWindow) {
		aboutWindow.show();
		return aboutWindow;
	}

	// Create a new 'About' window
	const window = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(window.webContents);

	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/about'
	});

	// Set the window icon from the store
	window.setIcon(Store.get('filePath').iconPath);
	window.hide();

	await window.loadURL(launchPath);
	window.setMenu(null);

	// Set up event listeners for the window
	window.on('show', () => {
		Menu.getApplicationMenu().getMenuItemById('gauzy-about').enabled = false;
	});

	window.on('close', (event) => {
		Menu.getApplicationMenu().getMenuItemById('gauzy-about').enabled = true;
		window.hide();
		event.preventDefault();
	});

	// Register the window with the window manager
	manager.register(RegisteredWindow.ABOUT, window);

	// Send a message to hide the menu if a preload path is provided
	if (preloadPath) {
		window.webContents.send('hide-menu');
	}

	return window;
}

/**
 * Configures and returns the settings for an Electron BrowserWindow.
 *
 * This function allows customization of the BrowserWindow's settings, including
 * web preferences, dimensions, and other options. If a `preloadPath` is provided,
 * it sets the preload script in the web preferences.
 *
 * @param {string | undefined} preloadPath - Optional path to the preload script for the BrowserWindow.
 * @returns {Electron.BrowserWindowConstructorOptions} - The configured settings for the BrowserWindow.
 */
const windowSetting = (preloadPath?: string): Electron.BrowserWindowConstructorOptions => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		roundedCorners: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			contextIsolation: false,
			sandbox: false
		},
		width: 300,
		height: 250,
		title: 'About',
		maximizable: false,
		show: false
	};

	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
	}

	return mainWindowSettings;
};
