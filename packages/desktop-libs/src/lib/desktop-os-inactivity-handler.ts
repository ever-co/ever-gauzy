import {
	DialogAcknowledgeInactivity,
	PowerManagerDetectInactivity
} from './decorators';
import NotificationDesktop from './desktop-notifier';
import { DesktopDialog } from './desktop-dialog';
import { BrowserWindow } from 'electron';
import { LocalStore } from './desktop-store';
import { DesktopOfflineModeHandler, IntervalService, TimerService } from './offline';
import moment from 'moment';
import {
	AlwaysSleepTracking,
	NeverSleepTracking,
} from './strategies';
import { SleepInactivityTracking, SleepTracking } from './contexts';
import { TranslateService } from './translation';

export class DesktopOsInactivityHandler {
	private _inactivityResultAccepted: boolean;
	private _powerManager: PowerManagerDetectInactivity;
	private _notify: NotificationDesktop;
	private _dialog: DesktopDialog;
	private _startedAt: Date;
	private _stoppedAt: Date;
	private _intervalService: IntervalService;
	private _timerService: TimerService;

	constructor(powerManager: PowerManagerDetectInactivity) {
		this._notify = new NotificationDesktop();
		this._powerManager = powerManager;
		this._inactivityResultAccepted = false;
		this._startedAt = null;
		this._stoppedAt = null;
		this._intervalService = new IntervalService();
		this._timerService = new TimerService();
		this._powerManager.detectInactivity.on(
			'activity-proof-request',
			async () => {
				if (!this._isAllowTrackInactivity) return;
				this._inactivityResultAccepted = false;
				this._windowFocus();
				this._startedAt = new Date();
				this._dialog = new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.STILL_WORKING'),
					powerManager.window
				);
				const button = await this._dialog.show();
				if (button?.response === 0) {
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
			}
		);
		this._powerManager.detectInactivity.on(
			'activity-proof-result',
			async (res) => {
				if (this._dialog) {
					this._dialog.close();
					delete this._dialog;
					let removeIdleTimePromise = null;
					let dialogPromise = null;
					if (this._isRemoveIdleTime) {
						removeIdleTimePromise = this._removeIdleTime(res);
					}
					if (!this._inactivityResultAccepted) {
						const dialog = new DialogAcknowledgeInactivity(
							new DesktopDialog(
								process.env.DESCRIPTION,
								TranslateService.instant('TIMER_TRACKER.DIALOG.INACTIVITY_HANDLER'),
								powerManager.window
							)
						);
						dialogPromise = dialog.show();
						if (powerManager.suspendDetected) {
							powerManager.window.webContents.send(
								'inactivity-result-not-accepted'
							);
						}
					}
					/* Handle multiple promises in parallel. */
					try {
						await Promise.allSettled([
							...(dialogPromise ? [dialogPromise] : []),
							...(removeIdleTimePromise ? [removeIdleTimePromise] : [])
						]);
					} catch (error) {
						console.log('Error', error);
					}
				}
				if (powerManager.suspendDetected) {
					powerManager.window.webContents.send(
						'activity-proof-request'
					);
				}
				if (!res)
					this._notify.customNotification(
						TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.STOPPED_DU_INACTIVITY'),
						process.env.DESCRIPTION,
					);
				this._inactivityResultAccepted = true;
			}
		);

		this._powerManager.detectInactivity.on(
			'activity-proof-result-not-accepted',
			() => {
				this._powerManager.sleepTracking = new SleepInactivityTracking(
					this._powerManager.suspendDetected && this.isTrackingOnSleep
						? new AlwaysSleepTracking(this._powerManager.window)
						: new NeverSleepTracking(this._powerManager.window)
				);
				this._powerManager.pauseTracking();
			}
		);

		this._powerManager.detectInactivity.on(
			'activity-proof-result-accepted',
			() => {
				this._powerManager.sleepTracking = new SleepTracking(
					this._powerManager.window
				);
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

	private async _removeIdleTime(isWorking: boolean): Promise<void> {
		const auth = LocalStore.getStore('auth');
		const inactivityTimeLimit = auth ? auth.inactivityTimeLimit : 10;
		const now = moment().clone();
		const proofResultDuration = now.diff(this._startedAt, 'minutes');
		const idleDuration = proofResultDuration + inactivityTimeLimit;
		this._stoppedAt = new Date();
		this._startedAt = now.subtract(idleDuration - inactivityTimeLimit / 2, 'minutes').toDate();
		const timeslotIds = await this._intervalService.removeIdlesTime(this._startedAt, this._stoppedAt);
		const timer = await this._timerService.findLastOne();
		const lastInterval = await this._intervalService.findLastInterval();
		timer.timeslotId = lastInterval?.remoteId;
		await this.updateViewOffline({
			startedAt: this._startedAt,
			stoppedAt: this._startedAt,
			idleDuration: idleDuration * 60,
			timer
		});
		this._powerManager.window.webContents.send('remove_idle_time', {
			timeslotIds,
			isWorking,
			timer
		});
	}

	public get isTrackingOnSleep(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.trackOnPcSleep : false;
	}

	public async updateViewOffline(params: any): Promise<void> {
		const offlineMode = DesktopOfflineModeHandler.instance;
		await offlineMode.connectivity();
		if (offlineMode.enabled) {
			this._powerManager.window.webContents.send('update_view', params);
		}
	}
}
