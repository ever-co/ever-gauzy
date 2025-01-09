import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { IBaseWindow } from '../interfaces';
import { IWindowConfig } from '../interfaces/iwindow-config';

export class DefaultWindow implements IBaseWindow {
	private _browserWindow: BrowserWindow;

	/**
	 * Initializes a new instance of a window manager.
	 *
	 * @param {IWindowConfig} config - The configuration object containing window options and navigation details.
	 */
	constructor(public readonly config: IWindowConfig) {
		// Create a new BrowserWindow instance with the provided options
		this._browserWindow = new BrowserWindow(this.config.options);

		// Enable Electron remote functionality
		remoteMain.enable(this._browserWindow.webContents);

		// Initially hide the window
		this.hide();

		// Set up behavior to hide the window instead of closing it
		this.browserWindow.on('close', (e) => {
			e.preventDefault(); // Prevent the default close operation
			this.hide(); // Hide the window
		});
	}

	/**
	 * Asynchronously constructs a URL using the provided configuration and loads it into the BrowserWindow.
	 * Logs the constructed URL and handles any errors during the loading process.
	 *
	 * @returns {Promise<void>} A promise that resolves once the URL is successfully loaded.
	 */
	public async loadURL(): Promise<void> {
		// Ensure the configuration has a valid path
		if (!this.config.path) return;

		try {
			// Construct the URL based on the configuration
			const launchPath = url.format({
				pathname: this.config.path,
				protocol: 'file:',
				slashes: true,
				hash: this.config.hash
			});

			// Load the URL into the BrowserWindow
			await this.browserWindow.loadURL(launchPath);

			// Log the constructed path for debugging purposes
			console.log('launched electron with:', launchPath);
		} catch (error) {
			// Log any errors during the URL loading process
			console.error('Failed to load URL:', error);
		}
	}

	/**
	 * Displays the BrowserWindow instance if it exists.
	 *
	 * @returns {void}
	 */
	public show(): void {
		if (!this.browserWindow) return; // Do nothing if the window doesn't exist
		this.browserWindow.show();
	}

	/**
	 * Hides the BrowserWindow instance if it exists and is not destroyed.
	 *
	 * @returns {void}
	 */
	public hide(): void {
		if (!this.browserWindow) return; // Do nothing if the window doesn't exist
		if (this.browserWindow.isDestroyed()) return; // Do nothing if the window is destroyed

		this.browserWindow.hide();
	}

	/**
	 * Closes and destroys the BrowserWindow instance if it exists and is not destroyed.
	 * Hides the window before destruction.
	 *
	 * @returns {void}
	 */
	public close(): void {
		if (!this.browserWindow) return; // Do nothing if the window doesn't exist
		if (this.browserWindow.isDestroyed()) return; // Do nothing if the window is already destroyed

		this.hide(); // Hide the window first
		this.browserWindow.destroy(); // Destroy the window
	}

	/**
	 * Getter for the BrowserWindow instance.
	 *
	 * @returns {BrowserWindow | null} The BrowserWindow instance if it exists and is not destroyed, otherwise null.
	 */
	public get browserWindow(): BrowserWindow | null {
		if (!this._browserWindow) {
			return null; // Return null if the window doesn't exist
		}

		if (this._browserWindow.isDestroyed()) {
			return null; // Do nothing if the window is already destroyed
		}

		return this._browserWindow; // Return the existing window instance
	}
}
