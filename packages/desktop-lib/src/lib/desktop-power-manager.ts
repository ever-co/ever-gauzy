import { BrowserWindow, powerMonitor } from 'electron';
import { SleepTracking } from './contexts';
import { LocalStore } from './desktop-store';
import { IPowerManager, ISleepTracking } from './interfaces';

export class DesktopPowerManager implements IPowerManager {
	private _suspendDetected: boolean;
	private _sleepTracking: ISleepTracking;
	private _window: BrowserWindow;
	private _isLockedScreen: boolean;
	private _suspendHandler: () => void;
	private _resumeHandler: () => void;
	private _lockScreenHandler: () => void;
	private _unlockScreenHandler: () => void;

	constructor(window: BrowserWindow) {
		this._sleepTracking = new SleepTracking(window);
		this._suspendDetected = false;
		this._isLockedScreen = false;
		this._window = window;

		// Store handlers for later removal
		this._suspendHandler = () => {
			console.log('System going to sleep.');
			this.pauseTracking();
		};
		this._resumeHandler = () => {
			console.log('System resumed from sleep state.');
			if (!this._isLockedScreen) {
				this.resumeTracking();
			}
		};
		this._lockScreenHandler = () => {
			console.log('System locked');
			this._isLockedScreen = true;
			this.pauseTracking();
		};
		this._unlockScreenHandler = () => {
			console.log('System unlocked');
			this._isLockedScreen = false;
			this.resumeTracking();
		};

		powerMonitor.on('suspend', this._suspendHandler);
		powerMonitor.on('resume', this._resumeHandler);
		powerMonitor.on('lock-screen', this._lockScreenHandler);
		powerMonitor.on('unlock-screen', this._unlockScreenHandler);
	}

	public get sleepTracking(): ISleepTracking {
		return this._sleepTracking;
	}

	public set sleepTracking(value: ISleepTracking) {
		this._sleepTracking = value;
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
			this._sleepTracking.strategy.pause();
			console.log('Tracker paused');
		}
	}

	public resumeTracking(): void {
		if (this._suspendDetected) {
			this._suspendDetected = false;
			this._sleepTracking.strategy.resume();
			console.log('Tracker resumed.');
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
	}
}
