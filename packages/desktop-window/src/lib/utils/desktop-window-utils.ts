// src/utils/desktop-window-utils.ts
import { BrowserWindow } from 'electron';
import * as url from 'url';

/**
 * Attaches a 'close' event handler to the specified BrowserWindow to prevent its destruction.
 * Instead of closing, the window is hidden when the 'close' event is triggered.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance to attach the 'close' event handler.
 *
 * @example
 * handleCloseEvent(settingsWindow);
 */
export function handleCloseEvent(window: BrowserWindow): void {
    window.on('close', (event) => {
        console.log('Close Event Triggered', window.getTitle(), window.getSize());
        event.preventDefault(); // Prevent the default close operation
        window.hide(); // Hide the window instead of destroying it
    });
}

/**
 * Constructs a URL with the specified file path and hash, and loads it into the given BrowserWindow.
 *
 * @param {BrowserWindow} window - The BrowserWindow instance where the URL will be loaded.
 * @param {string} filePath - The file path to construct the URL.
 * @param {string} [hash='/'] - An optional hash to append to the URL (default is '/').
 *
 * @returns {Promise<void>} A promise that resolves when the URL is successfully loaded.
 *
 * @example
 * await setLaunchPathAndLoad(myWindow, '/path/to/file.html', '/dashboard');
 */
export async function setLaunchPathAndLoad(
    window: BrowserWindow,
    filePath: string,
    hash: string = '/settings'
): Promise<void> {
	console.log(`Loading URL: ${filePath} with hash: ${hash}`);
	console.log(`Loading Window: ${window.getTitle()}`);
	if (process.env.NODE_ENV === 'development') {
		console.log('development process');
		return devLaunchPathAndLoad(window, filePath);
	}

    // Construct the URL with the provided file path and hash
    const launchPath = url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash
    });

    // Load the constructed URL into the specified window
    await window.loadURL(launchPath);

    // Log the constructed path for debugging purposes
    console.log('Launched Electron with:', launchPath);
}

async function devLaunchPathAndLoad(window: BrowserWindow, url: string){
	window.loadURL(url);
	return;
}
