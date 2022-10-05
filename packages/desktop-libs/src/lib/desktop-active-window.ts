import {EventEmitter} from "events";
import {ICurrentApplication} from "./interfaces";
import {CurrentApplication, DataApplication} from "./contexts";
import moment from "moment";

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
	private _ACTIVE_WINDOW_POLLING_INTERVAL: number = 1000;

	constructor() {
		super();
		this._pollingTimerId = null;
		this._currentApplication = new CurrentApplication(
			moment(new Date()).format(),
			0,
			new DataApplication(
				null,
				null,
				null,
				null
			)
		);
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
		if (this.active) return false;
		this._pollingTimerId = setInterval(async () =>
				await this.getWindow(),
			this._ACTIVE_WINDOW_POLLING_INTERVAL
		);
		return true;
	}

	/**
	 * Stops the active window polling
	 */
	public async stop() {
		if (!this._pollingTimerId) return;
		await this.getWindow(true);
		clearInterval(this._pollingTimerId);
		this._pollingTimerId = null;
	}

	/**
	 * Update current window
	 * @param window New window definition
	 * @private
	 */
	private applyNewWindow(window: any) {
		const end = moment(new Date(this._currentApplication.timestamp));
		const now = moment(new Date());
		this._currentApplication.duration = now.diff(end, 'seconds');
		this._currentApplication.data.title = window.title;
		this._currentApplication.data.executable = window.owner.path;
		this._currentApplication.data.name = window.owner.name;
		this._currentApplication.data.url = window.url;
		this.emit('updated', this._currentApplication.toObject());
		this._currentApplication.timestamp = now.format();
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
			if (window && window.owner
				&& (window.owner.path !== this._currentApplication.data.executable)
				|| (window.title !== this._currentApplication.data.title)
				|| (window.url !== this._currentApplication.data.url)
				|| anyway) {
				this.applyNewWindow(window);
			}
		} catch (e) {
			console.log('Error occurred during active window poll', e);
		}
	}
}
