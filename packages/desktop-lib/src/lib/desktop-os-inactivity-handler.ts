import { BrowserWindow } from 'electron';
import * as moment from 'moment';
import { TrackingSleepInactivity, TrackingSleep } from './contexts';
import { DialogAcknowledgeInactivity, PowerManagerDetectInactivity } from './decorators';
import { DesktopDialog } from './desktop-dialog';
import NotificationDesktop from './desktop-notifier';
import { LocalStore } from './desktop-store';
import { DesktopOfflineModeHandler, IntervalService, Timer, TimerService, TimerTO } from './offline';
import { AlwaysTrackingSleep, NeverTrackingSleep } from './strategies';
import { TranslateService } from './translation';
import { logger } from '@gauzy/desktop-core';

// Default values
const DEFAULT_INACTIVITY_TIME_LIMIT = 10; // minutes

/**
 * State object for inactivity session
 */
interface InactivitySessionState {
	startedAt: Date | null;
	stoppedAt: Date | null;
	accepted: boolean;
	dialog?: DesktopDialog;
}

export class DesktopOsInactivityHandler {
	private _powerManager: PowerManagerDetectInactivity;
	private _notify: NotificationDesktop;
	private _intervalService: IntervalService;
	private _timerService: TimerService;
	private _session: InactivitySessionState;
	private _activityProofRequestHandler: () => Promise<void>;
	private _activityProofResultHandler: () => Promise<void>;
	private _activityProofNotAcceptedHandler: () => Promise<void>;
	private _activityProofResultNotAcceptedHandler: () => Promise<void>;
	private _activityProofResultAcceptedHandler: () => Promise<void>;

	constructor(powerManager: PowerManagerDetectInactivity) {
		this._notify = new NotificationDesktop();
		this._powerManager = powerManager;
		this._intervalService = new IntervalService();
		this._timerService = new TimerService();
		this._session = { startedAt: null, stoppedAt: null, accepted: false };

		// Bind event handlers
		this._activityProofRequestHandler = this._onActivityProofRequest.bind(this);
		this._activityProofResultHandler = this._onActivityProofResult.bind(this);
		this._activityProofNotAcceptedHandler = this._onActivityProofNotAccepted.bind(this);
		this._activityProofResultNotAcceptedHandler = this._onActivityProofResultNotAccepted.bind(this);
		this._activityProofResultAcceptedHandler = this._onActivityProofResultAccepted.bind(this);

		this._powerManager.detectInactivity.on('activity-proof-request', this._activityProofRequestHandler);
		this._powerManager.detectInactivity.on('activity-proof-result', this._activityProofResultHandler);
		this._powerManager.detectInactivity.on('activity-proof-not-accepted', this._activityProofNotAcceptedHandler);
		this._powerManager.detectInactivity.on(
			'activity-proof-result-not-accepted',
			this._activityProofResultNotAcceptedHandler
		);
		this._powerManager.detectInactivity.on(
			'activity-proof-result-accepted',
			this._activityProofResultAcceptedHandler
		);
	}

	/**
	 * Handles the activity proof request event
	 */
	private async _onActivityProofRequest() {
		try {
			if (!this._isAllowTrackInactivity) return;
			this._session = { startedAt: new Date(), stoppedAt: null, accepted: false };
			this._windowFocus();
			const dialog = new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.STILL_WORKING'),
				this._powerManager.window
			);
			this._session.dialog = dialog;
			const button = await dialog.show();

			// Guard: Only handle the result if not already accepted
			if (!this._session.accepted) {
				const { response } = button || {};
				const accepted = response === 0;
				this._powerManager.detectInactivity.emit('activity-proof-result', {
					accepted,
					proof: true
				});
			}
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _onActivityProofRequest:', error);
		} finally {
			this.cleanUpDialog();
		}
	}

	/**
	 * Handles the activity proof result event
	 */
	private async _onActivityProofResult() {
		try {
			this._session.accepted = true;
			this.cleanUpDialog();
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _onActivityProofResult:', error);
		}
	}

	/**
	 * Handles the activity proof not accepted event
	 */
	private async _onActivityProofNotAccepted() {
		try {
			const dialog = new DialogAcknowledgeInactivity(
				new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.INACTIVITY_HANDLER'),
					this._powerManager.window
				)
			);
			logger.info('[OS_INACTIVITY_HANDLER] Activity Proof Result Not Accepted');
			const { suspendDetected, isOnBattery, window } = this._powerManager;
			if (!suspendDetected || !this.isTrackingSleep || isOnBattery) {
				this._powerManager.trackingSleep = new TrackingSleepInactivity(new NeverTrackingSleep(window));
			}
			await this._removeIdleTime(false);
			await dialog.show();
			this._notify.customNotification(
				TranslateService.instant('TIMER_TRACKER.NATIVE_NOTIFICATION.STOPPED_DU_INACTIVITY'),
				process.env.DESCRIPTION
			);
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _onActivityProofNotAccepted:', error);
		}
	}

	/**
	 * Handles the activity proof result not accepted event
	 */
	private async _onActivityProofResultNotAccepted() {
		try {
			const { suspendDetected, isOnBattery, window } = this._powerManager;
			this._powerManager.trackingSleep = new TrackingSleepInactivity(
				suspendDetected && this.isTrackingSleep && !isOnBattery
					? new AlwaysTrackingSleep(window)
					: new NeverTrackingSleep(window)
			);
			logger.info('[OS_INACTIVITY_HANDLER] Activity Proof Result Not Accepted');
			await this._removeIdleTime(false);
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _onActivityProofResultNotAccepted:', error);
		}
	}

	/**
	 * Handles the activity proof result accepted event
	 */
	private async _onActivityProofResultAccepted() {
		try {
			this._powerManager.trackingSleep = new TrackingSleep(this._powerManager.window);
			logger.info('[OS_INACTIVITY_HANDLER] Activity Proof Result Accepted');
			await this._removeIdleTime(true);
			this._powerManager.clearIntervals();
			this._powerManager.startInactivityDetection();
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _onActivityProofResultAccepted:', error);
		}
	}

	/**
	 * Focuses the main window
	 */
	private _windowFocus(): void {
		const window: BrowserWindow = this._powerManager.window;
		window.show();
		window.restore();
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

	/**
	 * Remove idle time and update timer/session state
	 */
	private async _removeIdleTime(isWorking: boolean): Promise<void> {
		if (!this._isRemoveIdleTime) {
			if (!isWorking) {
				this._powerManager.pauseTracking();
			}
			return;
		}
		try {
			const { startedAt, stoppedAt, idleDuration } = this._calculateIdleTime();
			const timeslotIds = await this._intervalService.removeIdlesTime(startedAt, stoppedAt);
			const lastTimer = await this._timerService.findLastOne();
			const lastInterval = await this._intervalService.findLastInterval(timeslotIds);
			const timer: TimerTO = { ...lastTimer, timeslotId: lastInterval?.remoteId, stoppedAt: startedAt };
			await this._timerService.update(new Timer(timer));
			await this._updateViewOffline({ startedAt, stoppedAt: startedAt, idleDuration: idleDuration * 60, timer });
			this._powerManager.window.webContents.send('remove_idle_time', { timeslotIds, isWorking, timer });
		} catch (error) {
			logger.error('[OS_INACTIVITY_HANDLER] Error in _removeIdleTime:', error);
		}
	}

	/**
	 * Calculate idle time based on session and settings
	 */
	private _calculateIdleTime(): { startedAt: Date; stoppedAt: Date; idleDuration: number } {
		const auth = LocalStore.getStore('auth');
		const inactivityTimeLimit = auth ? auth.inactivityTimeLimit : DEFAULT_INACTIVITY_TIME_LIMIT;
		const now = moment().clone();
		const proofResultDuration = this._session.startedAt ? now.diff(moment(this._session.startedAt), 'minute') : 0;
		const idleDuration = proofResultDuration + inactivityTimeLimit;
		const stoppedAt = now.toDate();
		const startedAt = now.subtract(idleDuration - inactivityTimeLimit / 2, 'minute').toDate();
		return { startedAt, stoppedAt, idleDuration };
	}

	/**
	 * Update the offline view if in offline mode
	 */
	private async _updateViewOffline(params: {
		startedAt: Date;
		stoppedAt: Date;
		idleDuration: number;
		timer: TimerTO;
	}): Promise<void> {
		const offlineMode = DesktopOfflineModeHandler.instance;
		await offlineMode.connectivity();
		if (offlineMode.enabled) {
			this._powerManager.window.webContents.send('update_view', params);
		}
	}

	public get isTrackingSleep(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.trackOnPcSleep : false;
	}

	/**
	 * Dispose and cleanup event listeners
	 */
	public dispose(): void {
		this.cleanUpDialog();
		this._powerManager.detectInactivity.removeListener('activity-proof-request', this._activityProofRequestHandler);
		this._powerManager.detectInactivity.removeListener('activity-proof-result', this._activityProofResultHandler);
		this._powerManager.detectInactivity.removeListener(
			'activity-proof-not-accepted',
			this._activityProofNotAcceptedHandler
		);
		this._powerManager.detectInactivity.removeListener(
			'activity-proof-result-not-accepted',
			this._activityProofResultNotAcceptedHandler
		);
		this._powerManager.detectInactivity.removeListener(
			'activity-proof-result-accepted',
			this._activityProofResultAcceptedHandler
		);
		this._powerManager.dispose();
	}

	private cleanUpDialog(): void {
		if (this._session.dialog) {
			this._session.dialog.close();
			this._session.dialog = null;
		}
	}
}
