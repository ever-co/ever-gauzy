import { EventEmitter } from 'events';
import { ICurrentApplication } from './interfaces';
import { CurrentApplication, DataApplication } from './contexts';
import * as moment from 'moment';
import { LocalStore } from './desktop-store';

const activeWindow = require('active-win');

export class DesktopActiveWindow extends EventEmitter {
	/**
	 * Current application parameters
	 * @private
	 */
	private _currentApplication: ICurrentApplication;

	/**
	 * Interval ID of polling timer
	 * @private
	 */
	private _pollingTimerId: any;

	/**
	 * Polling interval
	 * Delay between pools in milliseconds
	 * @private
	 */
	private _ACTIVE_WINDOW_POLLING_INTERVAL: number = 1000 * 10;

	constructor() {
		super();
		this._pollingTimerId = null;
		const t = moment(new Date()).utc().toISOString();
		console.log('DesktopActiveWindow -> constructor -> timestamp', t);
		this._currentApplication = new CurrentApplication(t, 0, new DataApplication(null, null, null, null));
	}

	/**
	 * Timer status
	 */
	public get active(): boolean {
		return this._pollingTimerId !== null;
	}

	/**
	 * Starts active window polling
	 * @returns  True if successfully started, false otherwise
	 */
	public start(): boolean {
		console.log('DesktopActiveWindow -> start -> this.active', this.active);
		if (this.active) return false;

		const t = moment(new Date()).utc().toISOString();

		this._currentApplication.timestamp = t;

		this._pollingTimerId = setInterval(async () => {
			if (this.isActivityWatch) return;
			await this.getWindow();
		}, this._ACTIVE_WINDOW_POLLING_INTERVAL);

		return true;
	}

	/**
	 * Stops the active window polling
	 */
	public async stop() {
		console.log('DesktopActiveWindow -> stop -> this.active', this.active);
		if (!this._pollingTimerId) return;
		await this.getWindow(true);
		if (this._pollingTimerId) clearInterval(this._pollingTimerId);
		this._pollingTimerId = null;
	}

	/**
	 * Update current window
	 * @param window New window definition
	 * @private
	 */
	private applyNewWindow(window: any) {
		console.log('DesktopActiveWindow -> applyNewWindow');
		const end = moment(new Date(this._currentApplication.timestamp));
		const now = moment(new Date());
		this._currentApplication.duration = now.diff(end, 'seconds');
		this._currentApplication.data.title = window.title;
		this._currentApplication.data.executable = window.owner.path;
		this._currentApplication.data.name = window.owner.name;
		this._currentApplication.data.url = window.url;
		this.emit('updated', this._currentApplication.toObject());
		this._currentApplication.timestamp = now.utc().toISOString();
	}

	/**
	 * Get current under anyway condition
	 * @param anyway if true update current window anyway
	 * @private
	 */
	private async getWindow(anyway: boolean = false) {
		try {
			const window = await activeWindow();

			// Detect changes
			if (
				window &&
				((window.owner && window.owner.path !== this._currentApplication.data.executable) ||
					window.title !== this._currentApplication.data.title ||
					window.url !== this._currentApplication.data.url ||
					anyway)
			) {
				console.log('DesktopActiveWindow -> getWindow -> applyNewWindow');
				this.applyNewWindow(window);
			}
		} catch (err) {
			console.error('Error occurred during active window poll', err);
		}
	}

	private get isActivityWatch(): boolean {
		const project = LocalStore.getStore('project');
		const setting = LocalStore.getStore('appSetting');
		return project && project.aw && project.aw.isAw && setting.awIsConnected;
	}

	public async updateActivities(): Promise<void> {
		console.log('DesktopActiveWindow -> updateActivities');
		await this.getWindow(true);
	}
}
