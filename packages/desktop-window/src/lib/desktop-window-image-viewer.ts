import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { WindowManager, RegisteredWindow, Store } from '@gauzy/desktop-core';

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
    handleWindowClose(imageViewWindow);

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
 * Constructs a URL and loads it into the specified BrowserWindow.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to load the URL into.
 * @param {string} filePath - The file path to construct the URL.
 * @param {string} [hash] - An optional hash to append to the URL (e.g., '/viewer').
 *
 * @returns {Promise<void>} A promise that resolves when the URL is successfully loaded into the window.
 *
 * @example
 * await setLaunchPathAndLoad(imageViewWindow, '/path/to/viewer.html', '/viewer');
 */
async function setLaunchPathAndLoad(
    window: Electron.BrowserWindow,
    filePath: string,
    hash: string = '/viewer'
): Promise<void> {
    // Construct the URL with the provided file path and hash
    const launchPath = url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash
    });

    // Load the constructed URL into the specified BrowserWindow
    await window.loadURL(launchPath);
}

/**
 * Attaches a 'close' event handler to prevent the destruction of the window.
 * Instead of being destroyed, the window is hidden when the 'close' event is triggered.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to handle the 'close' event.
 */
function handleWindowClose(window: BrowserWindow): void {
    window.on('close', (event) => {
        event.preventDefault();
        window.hide();
    });
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
    const filesPath = Store.get('filePath');
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
