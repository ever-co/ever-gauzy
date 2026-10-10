import { screen } from 'electron';
import {
	IBaseWindow,
	BaseWindow,
	WindowManager,
	DefaultWindow,
	WindowConfig,
	RegisteredWindow,
	store
} from '@gauzy/desktop-core';

export class ScreenCaptureNotification extends BaseWindow implements IBaseWindow {
	private static readonly WIDTH: number = 310;
	private static readonly HEIGHT: number = 170;
	private readonly manager = WindowManager.getInstance();

	/**
	 * Initializes a new instance of the `ScreenCaptureNotification` class.
	 *
	 * This constructor sets up a custom browser window for screen capture notifications.
	 * It utilizes the `WindowConfig` class to define the configuration for the window,
	 * including its size, position, and behavior. The window is positioned at the top-right
	 * corner of the primary display and is always on top.
	 *
	 * @param {string} [path] - An optional file path used to initialize the window content.
	 */
	constructor(path?: string, preloadPath?: string) {
		// Call the parent class constructor with a DefaultWindow instance
		super(
			new DefaultWindow(
				new WindowConfig('/screen-capture', path, {
					frame: false, // Removes the window frame
					resizable: false, // Prevents the window from being resized
					roundedCorners: true, // Enables rounded corners
					width: ScreenCaptureNotification.WIDTH, // Sets the window width
					height: ScreenCaptureNotification.HEIGHT, // Sets the window height
					alwaysOnTop: true, // Keeps the window always on top
					center: false, // Prevents the window from being centered
					focusable: false, // Makes the window non-focusable
					skipTaskbar: true, // Excludes the window from the taskbar
					...ScreenCaptureNotification.primaryDisplayPosition(), // Top-right corner of the primary display
					...(preloadPath
						? {
								webPreferences: {
									nodeIntegration: false,
									contextIsolation: true,
									webSecurity: false,
									preload: preloadPath,
									sandbox: false
								}
							}
						: {})
				})
			)
		);

		// Make the window visible on all workspaces
		this.browserWindow.setVisibleOnAllWorkspaces(true, {
			visibleOnFullScreen: true, // Keeps the window visible in full-screen mode
			skipTransformProcessType: false
		});

		// Keep the window always on top
		this.browserWindow.setAlwaysOnTop(true);

		// Prevent the window from being fullScreenable
		this.browserWindow.setFullScreenable(false);
		this.manager.overrideSystemContextMenu(this.browserWindow);

		// Register the window with the window manager
		this.manager.register(RegisteredWindow.CAPTURE, this);
	}

	/**
	 * Displays the browser window and sends a notification to the renderer process.
	 *
	 * This method makes the window visible in an inactive state and communicates
	 * relevant data, such as a project note and an optional thumbnail URL, to the
	 * renderer process through a specific IPC channel.
	 *
	 * @param {string} [thumbUrl] - An optional URL for a thumbnail image to include in the notification.
	 * @returns {void} - This method does not return any value.
	 */
	public show(thumbUrl?: string): void {
		if (!this.browserWindow) return;

		// The position was computed when the window was created. Displays get re-arranged while the
		// app runs (sleep/wake, a monitor plugged in or out, a new primary), after which the window
		// stayed on whatever monitor that old position now falls into (#7538): put it back on the
		// primary display every time it is shown.
		const { x, y } = ScreenCaptureNotification.primaryDisplayPosition();
		this.browserWindow.setPosition(x, y);

		// Display the browser window in an inactive state
		this.browserWindow.showInactive();

		// Send a notification to the renderer process with the project note and optional thumbnail URL
		this.browserWindow.webContents.send('show_popup_screen_capture', {
			note: store.get('project')?.note, // Retrieves the note from the store
			...(thumbUrl && { imgUrl: thumbUrl }) // Conditionally include the thumbnail URL if provided
		});
	}

	/**
	 * Top-right corner of the primary display's work area, 16 px from its edges.
	 *
	 * Uses the work area's own origin: the primary display is not always at (0, 0) in the virtual
	 * screen, and `size.width` alone landed the window on a neighbouring monitor in that case.
	 */
	private static primaryDisplayPosition(): { x: number; y: number } {
		const { workArea } = screen.getPrimaryDisplay();
		return {
			x: workArea.x + workArea.width - (ScreenCaptureNotification.WIDTH + 16),
			y: workArea.y + 16
		};
	}

	/**
	 * Hides the browser window after a delay.
	 *
	 * This method overrides the parent class's `hide` method to delay the hiding
	 * of the browser window by 3 seconds (3000 milliseconds). The delay ensures
	 * that any ongoing operations or animations have time to complete before the
	 * window is hidden.
	 *
	 * @returns {void} - This method does not return any value.
	 */
	public hide(): void {
		// Hide the browser window after a 3-second delay
		setTimeout(() => {
			super.hide(); // Calls the parent class's hide method
		}, 3000);
	}
}
