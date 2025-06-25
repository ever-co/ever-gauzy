import { BrowserWindow } from 'electron';
import { IPowerManager, ITrackingSleep } from '../../interfaces';

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
	public get trackingSleep(): ITrackingSleep {
		return this._decorator.trackingSleep;
	}
	public set trackingSleep(value: ITrackingSleep) {
		this._decorator.trackingSleep = value;
	}
	public get window(): BrowserWindow {
		return this._decorator.window;
	}
	public get suspendDetected(): boolean {
		return this._decorator.suspendDetected;
	}

	/**
	 * Dispose and cleanup resources/event handlers
	 */
	public dispose(): void {
		if (typeof this._decorator.dispose === 'function') {
			this._decorator.dispose();
		}
	}
}
