import {PowerManagerDetectInactivity} from "./decorators";
import NotificationDesktop from "./desktop-notifier";
import {DesktopDialog} from "./desktop-dialog";
import {BrowserWindow} from "electron";

export class DesktopOsInactivityHandler {
	private _inactivityResultAccepted: boolean;
	private _powerManager: PowerManagerDetectInactivity;
	private _notify: NotificationDesktop;
	private _dialog: DesktopDialog;

	constructor(powerManager: PowerManagerDetectInactivity) {
		this._notify = new NotificationDesktop();
		this._powerManager = powerManager;
		this._inactivityResultAccepted = false;
		this._powerManager.detectInactivity.on('activity-proof-request', async () => {
			this._inactivityResultAccepted = false;
			this._windowFocus();
			this._dialog = new DesktopDialog(
				'Gauzy',
				'Are you still working?',
				powerManager.decorator.window
			);
			this._dialog
				.show()
				.then((button) => {
					if (button.response === 0) {
						if (!this._inactivityResultAccepted) {
							this._inactivityResultAccepted = true;
							this._powerManager.detectInactivity.emit('activity-proof-result', true);
						}
					} else {
						if (!this._inactivityResultAccepted) {
							this._inactivityResultAccepted = true;
							this._powerManager.detectInactivity.emit('activity-proof-result', false);
						}
					}
				})
				.catch((error) => {
					console.log(error)
				});
		});
		this._powerManager.detectInactivity.on('activity-proof-result', res => {
			this._inactivityResultAccepted = true;
			if (this._dialog) {
				this._dialog.close();
				delete this._dialog;
			}
			if (!res) this._notify.customNotification(
				'Tracker was stopped due to inactivity!',
				'Gauzy'
			);
		});
	}

	/**
	 * Handle window focus request
	 */
	private _windowFocus(): void {
		// get window from decorator
		const window: BrowserWindow = this._powerManager.decorator.window;
		// show window if it hides
		window.show();
		// restore window if it's minified
		window.restore();
		// focus on the main window
		window.focus();
	}
}
