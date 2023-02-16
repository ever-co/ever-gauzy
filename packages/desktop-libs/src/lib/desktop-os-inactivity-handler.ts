import {
	DialogAcknowledgeInactivity,
	PowerManagerDetectInactivity
} from './decorators';
import NotificationDesktop from './desktop-notifier';
import { DesktopDialog } from './desktop-dialog';
import { BrowserWindow } from 'electron';
import { LocalStore } from './desktop-store';
import { IntervalService } from './offline';
import moment from 'moment';

export class DesktopOsInactivityHandler {
	private _inactivityResultAccepted: boolean;
	private _powerManager: PowerManagerDetectInactivity;
	private _notify: NotificationDesktop;
	private _dialog: DesktopDialog;
	private _waiting: number;
	private _waitingIntervalId: any;
	private _intervalService: IntervalService;


	constructor(powerManager: PowerManagerDetectInactivity) {
		this._notify = new NotificationDesktop();
		this._powerManager = powerManager;
		this._inactivityResultAccepted = false;
		this._waiting = 0;
		this._waitingIntervalId = null;
		this._intervalService = new IntervalService();
		this._powerManager.detectInactivity.on(
			'activity-proof-request',
			async () => {
				if (!this._isAllowTrackInactivity) return;
				this._inactivityResultAccepted = false;
				this._windowFocus();
				this._waiting = 0;
				if (!this._waitingIntervalId && this._isRemoveIdleTime) {
					this._waitingIntervalId = setInterval(() => {
						this._waiting++;
					}, 1000);
				}
				this._dialog = new DesktopDialog(
					'Gauzy',
					'Are you still working?',
					powerManager.window
				);
				this._dialog
					.show()
					.then((button) => {
						if (button.response === 0) {
							if (!this._inactivityResultAccepted) {
								this._inactivityResultAccepted = true;
								this._powerManager.detectInactivity.emit(
									'activity-proof-result',
									true
								);
							}
						} else {
							if (!this._inactivityResultAccepted) {
								this._inactivityResultAccepted = true;
								this._powerManager.detectInactivity.emit(
									'activity-proof-result',
									false
								);
							}
						}
					})
					.catch((error) => {
						console.log(error);
					});
			}
		);
		this._powerManager.detectInactivity.on(
			'activity-proof-result',
			async (res) => {
				if (this._dialog) {
					this._dialog.close();
					delete this._dialog;
					if (this._isRemoveIdleTime) await this._removeIdleTime();
					if (!this._inactivityResultAccepted) {
						const dialog = new DialogAcknowledgeInactivity(
							new DesktopDialog(
								'Gauzy',
								'Inactivity Handler',
								powerManager.window
							)
						);
						await dialog.show();
					}
				}
				if (!res)
					this._notify.customNotification(
						'Tracker was stopped due to inactivity!',
						'Gauzy'
					);
				this._inactivityResultAccepted = true;
			}
		);
	}

	/**
	 * Handle window focus request
	 */
	private _windowFocus(): void {
		// get window from decorator
		const window: BrowserWindow = this._powerManager.window;
		// show window if it hides
		window.show();
		// restore window if it's minified
		window.restore();
		// focus on the main window
		window.focus();
	}

	private get _isAllowTrackInactivity(): boolean {
		const auth = LocalStore.getStore('auth');
		return auth && auth.allowTrackInactivity;
	}

	private get _isRemoveIdleTime(): boolean {
		const auth = LocalStore.getStore('auth');
		return auth && auth.isRemoveIdleTime;
	}

	private _clearInterval() {
		clearInterval(this._waitingIntervalId);
		this._waitingIntervalId = null;
		this._waiting = 0;
	}

	private async _removeIdleTime(): Promise<void> {
		if (!this._waitingIntervalId) return;
		const auth = LocalStore.getStore('auth');
		const inactivityTimeLimit = auth ? auth.inactivityTimeLimit : 10;
		const stoppedAt = new Date();
		const startedAt = moment(stoppedAt).subtract(inactivityTimeLimit * 60 + this._waiting, 'seconds').toDate();
		const timeslotIds = await this._intervalService.removeIdlesTime(startedAt, stoppedAt);
		if (timeslotIds.length > 0) {
			this._powerManager.window.webContents.send('remove_idle_time', timeslotIds);
		}
		this._clearInterval();
	}
}
