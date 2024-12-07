import { BrowserWindow, powerMonitor } from 'electron';
import { SleepTracking } from './contexts';
import { LocalStore } from './desktop-store';
import { IPowerManager, ISleepTracking } from './interfaces';

export class DesktopPowerManager implements IPowerManager {
	private _suspendDetected: boolean;
	private _sleepTracking: ISleepTracking;
	private _window: BrowserWindow;
	private _isLockedScreen: boolean;

	constructor(window: BrowserWindow) {
		this._sleepTracking = new SleepTracking(window);
		this._suspendDetected = false;
		this._isLockedScreen = false;
		this._window = window;

		powerMonitor.on('suspend', () => {
			console.log('System going to sleep.');
			this.pauseTracking();
		});

		powerMonitor.on('resume', () => {
			console.log('System resumed from sleep state.');
			if (!this._isLockedScreen) {
				this.resumeTracking();
			}
		});

		powerMonitor.on('lock-screen', () => {
			console.log('System locked');
			this._isLockedScreen = true;
			this.pauseTracking();
		});

		powerMonitor.on('unlock-screen', () => {
			console.log('System unlocked');
			this._isLockedScreen = false;
			this.resumeTracking();
		});
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
}
