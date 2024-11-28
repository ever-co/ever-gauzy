import { BrowserWindow } from 'electron';
import { UpdateContext } from './update-context';
import * as  moment from 'moment';
import { LocalStore } from './../desktop-store';

export class AutomaticUpdate {
	private _context: UpdateContext;
	private _delay: number;
	private _intervalId: any;
	private _window: BrowserWindow;

	/**
	 * The constructor function is called when the class is instantiated. It takes two parameters, the
	 * first is the UpdateContext object, and the second is the BrowserWindow object. The UpdateContext
	 * object is used to check for updates, and the BrowserWindow object is used to display the update
	 * window
	 * @param {UpdateContext} context - UpdateContext - This is the context that is passed to the
	 * constructor of the class.
	 * @param {BrowserWindow} settingWindow - The window that will be used to display the update
	 * notification.
	 */
	constructor(context: UpdateContext, settingWindow: BrowserWindow) {
		this._context = context;
		this._delay = 1; // Default value is 1 hour
		this._intervalId = null;
		this._window = settingWindow;
	}

	/**
	 * It starts to checked for updates.
	 * @returns {void}.
	 */
	public start(): void {
		if (this._intervalId || !this.isEnabled) {
			return;
		}
		this._intervalId = setInterval(async () => {
			try {
				await this._context.checkUpdate();
			} catch (e) {
				this._window.webContents.send('error_update', e);
				console.log('Error on checking update:', e);
			}
		}, this.delay);
	}

	/**
	 * It stops to checked for updates.
	 * If the interval ID is not null, clear the interval and set the interval ID to null.
	 */
	public stop(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
	}

	/**
	 * It returns the delay in milliseconds.
	 * @returns The delay in milliseconds.
	 */
	public get delay(): number {
		const setting = LocalStore.getStore('appSetting');
		this._delay = setting?.automaticUpdateDelay
			? setting?.automaticUpdateDelay
			: 1;
		return moment.duration(this._delay, 'hours').asMilliseconds();
	}

	public set delay(value: number) {
		this.stop();
		this._delay = value;
		this.start();
	}

	public get isEnabled(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting?.automaticUpdate == true;
	}
}
