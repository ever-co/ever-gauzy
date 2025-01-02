import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, Menu, app } from 'electron';
import * as url from 'url';
import { WindowManager, RegisteredWindow, setupElectronLog, Store } from '@gauzy/desktop-core';

// Set up Electron log
setupElectronLog();

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
    filePath: string
): Promise<Electron.BrowserWindow> {
    // Retrieve the window configuration settings
    const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

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
 * Constructs a launch URL and loads it into the specified BrowserWindow.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to load the URL into.
 * @param {string} filePath - The file path to construct the launch URL.
 * @param {string} [hash] - An optional hash to append to the URL (e.g., '/setup').
 *
 * @returns {Promise<void>} A promise that resolves when the URL is loaded into the window.
 *
 * @example
 * await setLaunchPathAndLoad(setupWindow, '/path/to/file.html', '/setup');
 */
async function setLaunchPathAndLoad(
    window: BrowserWindow,
    filePath: string,
    hash: string = '/setup'
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
 * Handles the 'close' event for a given BrowserWindow to prevent it from being destroyed.
 * Instead, it hides the window when the event is triggered.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to attach the 'close' event handler.
 */
function handleCloseEvent(window: BrowserWindow): void {
    window.on('close', (event) => {
        event.preventDefault();
        window.hide(); // Optionally, replace with null if managing multiple windows
    });
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
const windowSetting = (): Electron.BrowserWindowConstructorOptions => {
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

	// Fetch the icon path from the application's store
	const filesPath = Store.get('filePath');
	if (filesPath?.iconPath) {
        mainWindowSettings.icon = filesPath.iconPath;
    }

    return mainWindowSettings;
};
