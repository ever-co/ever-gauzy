import EventEmitter from 'events';
import { NetworkStateManager } from '../contexts';
import { LocalStore } from '../desktop-store';
import { IOfflineMode } from '../interfaces';
import { ApiServerConnectivity } from '../states';

export class DesktopOfflineModeHandler
	extends EventEmitter
	implements IOfflineMode
{
	private static _instance: IOfflineMode;
	private _isEnabled: boolean;
	private _pingTimer: any;
	private _PING_INTERVAL: number;
	private _startedAt: Date;
	private _stoppedAt: Date;
	/**
	 * Build the class with default constructor
	 */
	private constructor() {
		super();
		// Initial status
		this._isEnabled = false;
		// Initial server ping timer
		this._pingTimer = null;
		// Default ping timer interval
		this._PING_INTERVAL = 30 * 1000;

		this.on('offline', () => {
			// Turn offline mode on
			this._isEnabled = true;
			// Date on trigger offline mode
			this._startedAt = new Date(Date.now());
		});

		this.on('connection-restored', () => {
			// Date on cancels offline mode
			this._stoppedAt = new Date(Date.now());
		});
	}
	public async connectivity(): Promise<void> {
		// Check connectivity
		const networkContext = new NetworkStateManager(
			new ApiServerConnectivity()
		);
		const connectivityEstablished = await networkContext.established();
		console.log('[NetworkContext]: ', connectivityEstablished);
		// If connection is not restored
		if (!connectivityEstablished) {
			if (!this._isEnabled) {
				// Notify that offline mode is enabled
				this.emit('offline');
			}
			console.log(
				'[OfflineModeHandler]:',
				'Connection still not restored'
			);
		} else {
			// Check again before restore
			(await networkContext.established())
				? this.restore() // Call offline mode restore routine
				: console.log('Waiting...'); // or waiting
		}
	}
	/**
	 * Triggers offline mode on.
	 * @returns {void}
	 */
	public trigger(): void {
		this._pingTimer = setInterval(async() => {
			this.connectivity();
		}, this._PING_INTERVAL);
	}
	/**
	 * Cancels offline mode
	 * @returns {void}
	 */
	public restore(): void {
		// Connection restored
		if (!this._isEnabled) {
			return;
		}
		// Reset state
		this._isEnabled = false;
		// Notify about reconnection event
		this.emit('connection-restored');
	}
	/**
	 * Returns status of offline mode (true if enabled)
	 * @returns {Boolean} Is offline mode enabled?
	 */
	public get enabled(): boolean {
		return this._isEnabled;
	}
	/**
	 * Single instance of offline mode handler
	 * @type {DesktopOfflineModeHandler}
	 */
	public static get instance(): IOfflineMode {
		if (!this._instance) {
			this._instance = new DesktopOfflineModeHandler();
		}
		return this._instance;
	}

	public get startedAt(): Date {
		return this._startedAt;
	}

	public get stoppedAt(): Date {
		return this._stoppedAt;
	}

	public set startedAt(value: Date) {
		this._startedAt = value;
	}

	public set stoppedAt(value: Date) {
		this._stoppedAt = value;
	}

	public get isTracking(): boolean {
		const setting = LocalStore.getStore('appSetting');
		return setting && setting.timerStarted;
	}
}
