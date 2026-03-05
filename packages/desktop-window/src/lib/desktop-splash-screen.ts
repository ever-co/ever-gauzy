import {
	BaseWindow,
	DefaultWindow,
	IBaseWindow,
	RegisteredWindow,
	WindowConfig,
	WindowManager
} from '@gauzy/desktop-core';

/**
 * Represents the splash screen window in the application.
 * This class is responsible for creating and managing the splash screen.
 */
export class SplashScreen extends BaseWindow implements IBaseWindow {
	private readonly manager = WindowManager.getInstance();

	/**
	 * Initializes a new instance of the SplashScreen class.
	 *
	 * @param {string} path - The file path to load in the splash screen.
	 */
	constructor(
		public path: string,
		public preloadPath?: string,
		public contextIsolation?: boolean
	) {
		// Configure the splash screen with default properties
		super(
			new DefaultWindow(
				new WindowConfig('/splash-screen', path, {
					frame: false,
					resizable: false,
					width: 300,
					height: 240
				})
			)
		);

		// Disable the menu bar for the splash screen
		this.initializeWindowSettings();
		if (contextIsolation) {
			this.config.options.webPreferences.contextIsolation = true;
			this.config.options.webPreferences.preload = preloadPath;
			this.config.options.webPreferences.nodeIntegration = false;
		}

		// Register the splash screen with the WindowManager
		this.registerWindow();
		this.manager.overrideSystemContextMenu(this.browserWindow);
		// Handle the close event to ensure proper cleanup
		this.browserWindow.on('close', () => {
			if (this.isDestroyed()) return;
			this.browserWindow.destroy();
			this.manager.unregister(RegisteredWindow.SPLASH);
		});
	}

	/**
	 * Initializes the settings for the splash screen window.
	 * Disables the menu bar and applies additional configurations.
	 */
	private initializeWindowSettings(): void {
		this.browserWindow.setMenuBarVisibility(false);
	}

	/**
	 * Registers the splash screen with the WindowManager.
	 */
	private registerWindow(): void {
		this.manager.register(RegisteredWindow.SPLASH, this);
	}

	/**
	 * Checks if the splash screen window has been destroyed.
	 * @return {boolean} `true` if the window is destroyed; otherwise, `false`.
	 */
	private isDestroyed(): boolean {
		return !!this.browserWindow && this.browserWindow.isDestroyed();
	}
}
