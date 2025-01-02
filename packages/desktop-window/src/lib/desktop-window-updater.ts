import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, setupElectronLog, Store } from '@gauzy/desktop-core';

// Set up Electron log
setupElectronLog();

/**
 * Creates and configures the updater window in the Electron application.
 *
 * @param {Electron.BrowserWindow} updaterWindow - The variable to hold the reference to the updater window.
 * @param {string} filePath - The file path to the HTML file to load in the updater window.
 * @param {string} [preloadPath] - The path to the preload script (optional).
 * Enables additional window configurations if provided.
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured updater window instance.
 */
export async function createUpdaterWindow(
    updaterWindow: Electron.BrowserWindow,
    filePath: string,
    preloadPath?: string
): Promise<Electron.BrowserWindow> {
    // Get the main window settings using the utility function
    const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);

    // Get the singleton instance of the WindowManager
    const manager = WindowManager.getInstance();

    // Create a new BrowserWindow with the specified settings
    updaterWindow = new BrowserWindow(mainWindowSettings);

    // Enable remote support for the window (for use with electron-remote/main)
    remoteMain.enable(updaterWindow.webContents);

    // Hide the window initially and load the specified URL
    updaterWindow.hide();

	// Set the launch path and load it into the updater window
	await setLaunchPathAndLoad(updaterWindow, filePath);

    // Remove the default menu from the window
    updaterWindow.setMenu(null);

    // Optional: Uncomment to enable developer tools
    // updaterWindow.webContents.toggleDevTools();

    // Attach the close event handler
    handleCloseEvent(updaterWindow);

    // Register the window instance with the WindowManager
    manager.register(RegisteredWindow.UPDATER, updaterWindow);

    // If a preload path is provided, attach a custom title bar to the window
    if (preloadPath) {
        attachTitlebarToWindow(updaterWindow);
    }

    // Return the configured window instance
    return updaterWindow;
}

/**
 * Constructs a launch path and loads it into the specified BrowserWindow.
 *
 * @param {Electron.BrowserWindow} window - The BrowserWindow instance to load the URL into.
 * @param {string} filePath - The file path to construct the launch URL.
 * @param {string} [hash] - An optional hash to append to the URL (e.g., '/updater').
 *
 * @returns {Promise<void>} A promise that resolves when the URL is loaded into the window.
 */
async function setLaunchPathAndLoad(window: Electron.BrowserWindow, filePath: string, hash: string = '/updater'): Promise<void> {
    const launchPath = url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash
    });
    await window.loadURL(launchPath);
}

/**
 * Handles the `close` event for a given BrowserWindow, preventing it from fully closing.
 *
 * @param {Electron.BrowserWindow} window - The BrowserWindow instance to apply the close event handler.
 */
function handleCloseEvent(window: Electron.BrowserWindow): void {
    window.on('close', (event) => {
        window.hide();
        event.preventDefault();
    });
}

/**
 * Configures and returns the settings for the main Electron browser window.
 *
 * @param {string} preloadPath - The path to the preload script. If provided,
 * additional settings such as `preload`, `titleBarOverlay`, and `titleBarStyle`
 * are applied. On Linux, the frame will be disabled if preloadPath is specified.
 *
 * @returns {Electron.BrowserWindowConstructorOptions} The settings object for
 * the main Electron browser window.
 */
const windowSetting = (preloadPath: string): Electron.BrowserWindowConstructorOptions => {
    // Get the file paths from the application store
    const filesPath = Store.get('filePath');
	console.log('Store filePath', filesPath);

    // Define the default settings for the main Electron browser window
    const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
        frame: true,
        resizable: false,
        focusable: true,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            devTools: true,
            contextIsolation: false,
            sandbox: false
        },
        width: 700,
        height: 600,
        title: 'Gauzy Updater',
        maximizable: false,
        show: false
    };

    // Assign the application icon
    mainWindowSettings.icon = filesPath.iconPath;

    // Apply additional settings if preloadPath is provided
    if (preloadPath) {
        mainWindowSettings.webPreferences.preload = preloadPath;
        mainWindowSettings.titleBarOverlay = true;
        mainWindowSettings.titleBarStyle = 'hidden';

        // Disable the frame on Linux if preloadPath is specified
        if (process.platform === 'linux') {
            mainWindowSettings.frame = false;
        }
    }

    // Return the configured window settings
    return mainWindowSettings;
};
