
import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow
} from '@gauzy/desktop-core';

/**
 * Represents the splash screen window in the application.
 * This class is responsible for creating and managing the splash screen.
 */
export class AuthWindow extends BaseWindow implements IBaseWindow {
    private readonly manager = WindowManager.getInstance();
    /**
     * Initializes a new instance of the SplashScreen class.
     *
     * @param {string} path - The file path to load in the splash screen.
     */
    constructor(public path: string, public preloadPath?: string, public contextIsolation?: boolean) {
        // Configure the splash screen with default properties
		console.log('preloadPath', preloadPath);
		console.log('path ', path);
        super(
            new DefaultWindow(
                new WindowConfig('auth/login', path, {
                    frame: true,
                    resizable: false,
                    width: 360,
                    height: 768
                })
            )
        );

        // Disable the menu bar for the splash screen
		if (contextIsolation) {
			this.config.options.webPreferences.contextIsolation = true;
			this.config.options.webPreferences.preload = preloadPath;
			this.config.options.webPreferences.nodeIntegration = false;
		}

        // Register the splash screen with the WindowManager
        this.registerWindow();
    }

    /**
     * Registers the splash screen with the WindowManager.
     */
    private registerWindow(): void {
        this.manager.register(RegisteredWindow.AUTH, this);
    }
}
