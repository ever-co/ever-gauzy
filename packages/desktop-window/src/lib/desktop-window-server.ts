import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, Store, setupElectronLog } from '@gauzy/desktop-core';

// Set up Electron log
setupElectronLog();

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
    config: object,
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
 * Constructs a URL with the specified file path and hash, and loads it into the given BrowserWindow.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to load the URL into.
 * @param {string} filePath - The file path to construct the URL.
 * @param {string} [hash] - An optional hash to append to the URL (default: '/server-dashboard').
 *
 * @returns {Promise<void>} A promise that resolves when the URL is successfully loaded into the window.
 *
 * @example
 * await setLaunchPathAndLoad(serverWindow, '/path/to/server.html', '/server-dashboard');
 */
async function setLaunchPathAndLoad(
    window: BrowserWindow,
    filePath: string,
    hash: string = '/server-dashboard'
): Promise<void> {
    // Construct the URL
    const launchPath = url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash
    });

    // Load the constructed URL into the specified BrowserWindow
    await window.loadURL(launchPath);

    // Log the launched path for debugging purposes
    console.log('Launched Electron with:', launchPath);
}

/**
 * Attaches a 'close' event handler to prevent the destruction of the specified window.
 * Instead of closing, the window is hidden when the 'close' event is triggered.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to attach the 'close' event handler.
 */
function handleCloseEvent(window: Electron.BrowserWindow): void {
    window.on('close', (event) => {
        event.preventDefault(); // Prevent the default close operation
        window.hide(); // Hide the window instead of destroying it
    });
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
    const filesPath = Store.get('filePath');
    if (filesPath?.iconPath) {
        mainWindowSettings.icon = filesPath.iconPath;
    }

    return mainWindowSettings;
};
