import * as remoteMain from '@electron/remote/main';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { WindowManager, RegisteredWindow, Store, setupElectronLog } from '@gauzy/desktop-core';
import { handleCloseEvent, setLaunchPathAndLoad } from './utils/desktop-window-utils';

// Set up Electron log
setupElectronLog();

/**
 * Creates and configures the settings window in the Electron application.
 *
 * @param {Electron.BrowserWindow | null} settingsWindow - The reference to the settings window instance (can be null initially).
 * @param {string} filePath - The file path to the HTML file for the settings window.
 * @param {string} [preloadPath] - An optional path to the preload script for the window.
 *
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves to the configured settings window instance.
 *
 * @example
 * const settingsWindow = await createSettingsWindow(null, '/path/to/settings.html', '/path/to/preload.js');
 */
export async function createSettingsWindow(
    settingsWindow: Electron.BrowserWindow | null,
    filePath: string,
    preloadPath?: string
): Promise<Electron.BrowserWindow> {
    // Retrieve the main window settings using the optional preload script
    const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);

    // Get the WindowManager instance for managing windows
    const manager = WindowManager.getInstance();

    // Create a new BrowserWindow for the settings window
    settingsWindow = new BrowserWindow(mainWindowSettings);

    // Enable remote functionality for the settings window
    remoteMain.enable(settingsWindow.webContents);

	// Hide the window initially
    settingsWindow.hide();

	// Use the helper function to construct and load the URL
    await setLaunchPathAndLoad(settingsWindow, filePath, '/settings');

    // Remove the menu from the window
    settingsWindow.setMenu(null);

	// Attach the reusable close event handler
	handleCloseEvent(settingsWindow);

    // Optionally attach a custom title bar if a preload script is provided
    if (preloadPath) {
        attachTitlebarToWindow(settingsWindow);
    }

    // Register the settings window with the WindowManager
    manager.register(RegisteredWindow.SETTINGS, settingsWindow);

    // Return the configured settings window instance
    return settingsWindow;
}

/**
 * Generates and returns configuration settings for an Electron BrowserWindow.
 * Allows customization with an optional preload script path.
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
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            devTools: true,
            contextIsolation: false,
            sandbox: false
        },
        width: 1000,
        height: 800,
        title: 'Settings',
        maximizable: false,
        show: false
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

/**
 * Constructs a URL for the settings page using the specified file path.
 *
 * @param {string} filePath - The file path to the HTML file for the settings page.
 *
 * @returns {string} The formatted URL pointing to the settings page.
 */
export function settingsPage(filePath: string): string {
    return url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash: '/settings'
    });
}
