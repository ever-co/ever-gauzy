import { BrowserWindow } from 'electron';
import { IPowerManager, ISleepTracking } from '../../interfaces';

export abstract class BasePowerManagerDecorator implements IPowerManager {
	private readonly _decorator: IPowerManager;

	protected constructor(powerManager: IPowerManager) {
		this._decorator = powerManager;
	}
	public get isOnBattery(): boolean {
		return this._decorator.isOnBattery;
	}
	public pauseTracking(): void {
		this._decorator.pauseTracking();
	}
	public resumeTracking(): void {
		this._decorator.resumeTracking();
	}
	public get trackerStatusActive(): boolean {
		return this._decorator.trackerStatusActive;
	}
	public get sleepTracking(): ISleepTracking {
		return this._decorator.sleepTracking;
	}
	public set sleepTracking(value: ISleepTracking) {
		this._decorator.sleepTracking = value;
	}
	public get window(): BrowserWindow {
		return this._decorator.window;
	}
	public get suspendDetected(): boolean {
		return this._decorator.suspendDetected;
	}
}
