import { logger } from '@gauzy/desktop-core';
import { BrowserWindow, powerMonitor } from 'electron';
import { TrackingSleep } from './contexts';
import { LocalStore } from './desktop-store';
import { IPowerManager, ITrackingSleep } from './interfaces';

export class DesktopPowerManager implements IPowerManager {
	private _suspendDetected: boolean;
	private _trackingSleep: ITrackingSleep;
	private _window: BrowserWindow;
	private _isLockedScreen: boolean;
	private _suspendHandler: () => void;
	private _resumeHandler: () => void;
	private _lockScreenHandler: () => void;
	private _unlockScreenHandler: () => void;

	constructor(window: BrowserWindow) {
		this._trackingSleep = new TrackingSleep(window);
		this._suspendDetected = false;
		this._isLockedScreen = false;
		this._window = window;

		// Store handlers for later removal
		this._suspendHandler = () => {
			logger.info('System going to sleep.');
			this.pauseTracking();
		};
		this._resumeHandler = () => {
			logger.info('System resumed from sleep state.');
			if (!this._isLockedScreen) {
				this.resumeTracking();
			}
		};
		this._lockScreenHandler = () => {
			logger.info('System locked');
			this._isLockedScreen = true;
			this.pauseTracking();
		};
		this._unlockScreenHandler = () => {
			logger.info('System unlocked');
			this._isLockedScreen = false;
			this.resumeTracking();
		};

		powerMonitor.on('suspend', this._suspendHandler);
		powerMonitor.on('resume', this._resumeHandler);
		powerMonitor.on('lock-screen', this._lockScreenHandler);
		powerMonitor.on('unlock-screen', this._unlockScreenHandler);
	}

	public get trackingSleep(): ITrackingSleep {
		return this._trackingSleep;
	}

	public set trackingSleep(value: ITrackingSleep) {
		this._trackingSleep = value;
	}

	public get trackerStatusActive(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.timerStarted : false;
	}

	public get window() {
		return this._window;
	}

	public set window(value: BrowserWindow) {
		this._window = value;
	}

	public get suspendDetected(): boolean {
		return this._suspendDetected;
	}

	public pauseTracking(): void {
		if (this.trackerStatusActive && !this._suspendDetected) {
			this._suspendDetected = true;
			this._trackingSleep.strategy.pause();
			logger.info('Tracker paused');
		}
	}

	public resumeTracking(): void {
		if (this._suspendDetected) {
			this._suspendDetected = false;
			this._trackingSleep.strategy.resume();
			logger.info('Tracker resumed.');
		}
	}

	public get isOnBattery(): boolean {
		return powerMonitor.isOnBatteryPower();
	}

	/**
	 * Remove all event listeners registered by this instance
	 */
	public dispose(): void {
		powerMonitor.removeListener('suspend', this._suspendHandler);
		powerMonitor.removeListener('resume', this._resumeHandler);
		powerMonitor.removeListener('lock-screen', this._lockScreenHandler);
		powerMonitor.removeListener('unlock-screen', this._unlockScreenHandler);
		this._trackingSleep.strategy.dispose();
	}
}
