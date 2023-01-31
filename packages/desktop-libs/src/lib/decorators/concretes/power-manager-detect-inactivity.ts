import { BasePowerManagerDecorator } from '../abstracts/base-power-manager-decorator';
import { SleepInactivityTracking, SleepTracking } from '../../contexts';
import { ControlledSleepTracking } from '../../strategies';
import { IPowerManager } from '../../interfaces';
import { powerMonitor } from 'electron';
import EventEmitter from 'events';
import { LocalStore } from '../../desktop-store';

export class PowerManagerDetectInactivity extends BasePowerManagerDecorator {
	private readonly _detectionEmitter: EventEmitter;
	private readonly _inactivityTimeLimit: number;
	private readonly _activityProofDuration: number;
	private _inactivityDetectionIntervalId: any;
	private _activityProofTimeoutIntervalId: any;

	constructor(powerManager: IPowerManager) {
		super(powerManager);
		this._inactivityDetectionIntervalId = null;
		this._activityProofTimeoutIntervalId = null;
		this._inactivityTimeLimit = this._isAllowTrackInactivity
			? this.inactivityTimeLimit * 60 // inactivityTimeLimit fixed to 10 minutes
			: Infinity;
		this._activityProofDuration = this.activityProofDuration * 60; // activityProofDuration fixed to 1 minutes
		this._detectionEmitter = new EventEmitter();
		this._detectionEmitter.on('activity-proof-result', async (res) => {
			if (this._activityProofTimeoutIntervalId) {
				clearTimeout(this._activityProofTimeoutIntervalId);
				this._activityProofTimeoutIntervalId = null;
			}
			if (!powerManager.trackerStatusActive) return;
			if (res) {
				this._detectionEmitter.emit(
					'activity-proof-result-accepted',
					true
				);
				this.startInactivityDetection();
				return;
			}
			this._detectionEmitter.emit('activity-proof-result-not-accepted');
			powerManager.sleepTracking = new SleepInactivityTracking(
				new ControlledSleepTracking(powerManager.window)
			);
			powerManager.pauseTracking();
		});
	}

	public get detectInactivity(): EventEmitter {
		return this._detectionEmitter;
	}

	public startInactivityDetection(): void {
		if (
			this._inactivityDetectionIntervalId ||
			!this._isAllowTrackInactivity
		)
			return;
		super.decorator.resumeTracking();
		super.decorator.sleepTracking = new SleepTracking(
			this.decorator.window
		);
		this._inactivityDetectionIntervalId = setInterval(() => {
			const currentIdleTime = powerMonitor.getSystemIdleTime();
			if (currentIdleTime > this._inactivityTimeLimit) {
				this._detectionEmitter.emit('inactivity-detected');
				this.triggerInactivityDetection();
				clearInterval(this._inactivityDetectionIntervalId);
				this._inactivityDetectionIntervalId = null;
			}
		}, 1000);
	}

	public stopInactivityDetection(): void {
		if (this._inactivityDetectionIntervalId) {
			clearInterval(this._inactivityDetectionIntervalId);
			this._inactivityDetectionIntervalId = null;
		}
	}

	public triggerInactivityDetection(): void {
		this._detectionEmitter.emit(
			'activity-proof-request',
			this._activityProofDuration * 1000
		);
		this._activityProofTimeoutIntervalId = setTimeout(
			() => this._detectionEmitter.emit('activity-proof-result', false),
			(this._activityProofDuration + 1) * 1000
		);
	}

	public get inactivityTimeLimit(): number {
		const auth = LocalStore.getStore('auth');
		return auth ? auth.inactivityTimeLimit : 10;
	}

	public get activityProofDuration(): number {
		const auth = LocalStore.getStore('auth');
		return auth ? auth.activityProofDuration : 1;
	}

	private get _isAllowTrackInactivity(): boolean {
		const auth = LocalStore.getStore('auth');
		return auth && auth.allowTrackInactivity;
	}
}
