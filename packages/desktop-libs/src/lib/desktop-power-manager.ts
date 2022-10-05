import {BrowserWindow, powerMonitor} from "electron";
import {SleepTracking} from "./contexts";
import {IPowerManager, ISleepTracking} from "./interfaces";
import {LocalStore} from "./desktop-store";

export class DesktopPowerManager implements IPowerManager {
	private _suspendDetected: boolean;
	private _sleepTracking: ISleepTracking;

	constructor(window: BrowserWindow) {
		this._sleepTracking = new SleepTracking(window);
		this._suspendDetected = false;
		powerMonitor.on('suspend', () => {
			console.log('System going to sleep.');
			this.pauseTracking();
		});

		powerMonitor.on('resume', () => {
			console.log('System resumed from sleep state.');
			this.resumeTracking();
		});

		powerMonitor.on('lock-screen', () => {
			console.log('System locked');
			this.pauseTracking();
		});

		powerMonitor.on('unlock-screen', () => {
			console.log('System unlocked');
			this.resumeTracking();
		});
	}

	get trackerStatusActive(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting ? setting.timerStarted : false;
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
}
