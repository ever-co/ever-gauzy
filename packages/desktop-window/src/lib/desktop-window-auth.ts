
import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow
} from '@gauzy/desktop-core';

/**
 * Represents the Authentication  window in the application.
 * This class is responsible for creating and managing the splash screen.
 */
export class AuthWindow extends BaseWindow implements IBaseWindow {
    private readonly manager = WindowManager.getInstance();
    /**
     * Initializes a new instance of the Authentication class.
     *
     * @param {string} path - The file path to load in the splash screen.
     */
    constructor(public path: string, public preloadPath?: string, public contextIsolation?: boolean) {
        // Configure the Authentication with default properties
        super(
            new DefaultWindow(
                new WindowConfig('auth/login', path, {
                    frame: true,
                    resizable: false,
                    width: 1000,
                    height: 768
                })
            )
        );

        // Disable the menu bar for the Authentication
		if (contextIsolation && preloadPath) {
			this.config.options.webPreferences.contextIsolation = true;
			this.config.options.webPreferences.preload = preloadPath;
			this.config.options.webPreferences.nodeIntegration = false;
		}

        // Register the Authentication with the WindowManager
        this.registerWindow();
    }

    /**
     * Registers the Authentication with the WindowManager.
     */
    private registerWindow(): void {
        this.manager.register(RegisteredWindow.AUTH, this);
    }
}
