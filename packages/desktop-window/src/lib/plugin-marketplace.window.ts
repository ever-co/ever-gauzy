import {
	BaseWindow,
	DefaultWindow,
	IBaseWindow,
	RegisteredWindow,
	WindowConfig,
	WindowManager
} from '@gauzy/desktop-core';

export class PluginMarketplaceWindow extends BaseWindow implements IBaseWindow {
	private readonly manager = WindowManager.getInstance();

	/**
	 * Initializes a new instance of the PluginMarketplaceWindow class.
	 *
	 * @param {string} path - The file path to load in the plugin marketplace window.
	 */
	constructor(public path: string, public preloadPath?: string, public contextIsolation?: boolean) {
		// Configure the plugin marketplace window with default properties
		super(
			new DefaultWindow(
				new WindowConfig('/plugins', path, {
					resizable: true,
					width: 1280,
					height: 720
				})
			)
		);

		// Disable the menu bar for the plugin marketplace window
		if (contextIsolation) {
			this.config.options.webPreferences.contextIsolation = true;
			this.config.options.webPreferences.preload = preloadPath;
			this.config.options.webPreferences.nodeIntegration = false;
		}

		// Register the plugin marketplace window with the WindowManager
		this.registerWindow();
	}

	/**
	 * Registers the plugin marketplace window with the WindowManager.
	 */
	private registerWindow(): void {
		this.manager.register(RegisteredWindow.PLUGINS, this);
	}
}
