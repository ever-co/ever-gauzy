import { BrowserWindow, ipcMain } from 'electron';
import moment from 'moment';
import { SleepInactivityTracking, SleepTracking } from './contexts';
import { DialogAcknowledgeInactivity, PowerManagerDetectInactivity } from './decorators';
import { DesktopDialog } from './desktop-dialog';
import NotificationDesktop from './desktop-notifier';
import { LocalStore } from './desktop-store';
import { DesktopOfflineModeHandler, IntervalService, Timer, TimerService, TimerTO } from './offline';
import { AlwaysSleepTracking, NeverSleepTracking } from './strategies';
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

		this._powerManager.detectInactivity.on('activity-proof-request', async () => {
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

			if (!this._inactivityResultAccepted) {
				const { response } = button || {};
				const accepted = response === 0;

				this._powerManager.detectInactivity.emit('activity-proof-result', {
					accepted,
					proof: true
				});
			}
		});

		this._powerManager.detectInactivity.on('activity-proof-result', async ({ accepted, proof }) => {
			this._inactivityResultAccepted = true;

			if (!this._dialog) return;

			this._dialog.close();
			delete this._dialog;

			ipcMain.on('pause-tracking', async () => {
				if (this._isRemoveIdleTime) {
					await this._removeIdleTime(accepted);
				}
			});
		});

		this._powerManager.detectInactivity.on('activity-proof-not-accepted', async () => {
			const dialog = new DialogAcknowledgeInactivity(
				new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.INACTIVITY_HANDLER'),
					powerManager.window
				)
			);
			if (this._isRemoveIdleTime) {
				await this._removeIdleTime(false);
			}
			await dialog.show();
			this._notify.customNotification(
				TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.STOPPED_DU_INACTIVITY'),
				process.env.DESCRIPTION
			);
		});

		this._powerManager.detectInactivity.on('activity-proof-result-not-accepted', () => {
			this._powerManager.sleepTracking = new SleepInactivityTracking(
				this._powerManager.suspendDetected && this.isTrackingOnSleep
					? new AlwaysSleepTracking(this._powerManager.window)
					: new NeverSleepTracking(this._powerManager.window)
			);
			this._powerManager.pauseTracking();
		});

		this._powerManager.detectInactivity.on('activity-proof-result-accepted', async () => {
			this._powerManager.sleepTracking = new SleepTracking(this._powerManager.window);
			if (this._isRemoveIdleTime) {
				await this._removeIdleTime(true);
			}
		});
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
		this._stoppedAt = now.toDate();
		this._startedAt = now.subtract(idleDuration - inactivityTimeLimit / 2, 'minutes').toDate();
		const timeslotIds = await this._intervalService.removeIdlesTime(this._startedAt, this._stoppedAt);
		const lastTimer = await this._timerService.findLastOne();
		const lastInterval = await this._intervalService.findLastInterval(timeslotIds);
		const timer: TimerTO = { ...lastTimer, timeslotId: lastInterval?.remoteId, stoppedAt: this._startedAt };
		await this._timerService.update(new Timer(timer));

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
