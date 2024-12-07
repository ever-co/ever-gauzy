import EventEmitter from 'events';
import { NetworkStateManager } from '../contexts';
import { LocalStore } from '../desktop-store';
import { IOfflineMode } from '../interfaces';
import { ApiServerConnectivity } from '../states';

export class DesktopOfflineModeHandler extends EventEmitter implements IOfflineMode {
	private static _instance: IOfflineMode;
	private _isEnabled: boolean;

	/**
	 * Timer used for pinging the server in offline mode.
	 * TODO: destroy on exit from app?
	 */
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

		// Default ping timer interval set to 40 seconds
		this._PING_INTERVAL = 40 * 1000;

		this.on('connection-restored', () => {
			console.log('[OfflineModeHandler]: Connection restored');
			// Date on cancels offline mode
			this._stoppedAt = new Date(Date.now());
		});
	}

	public async connectivity(): Promise<void> {
		let isEmitted = false;

		try {
			console.log('[OfflineModeHandler]: Checking connection...');

			const networkContext = new NetworkStateManager(new ApiServerConnectivity());

			const connectivityEstablished = await networkContext.established();

			console.log('[OfflineModeHandler]. Connectivity Established: ', connectivityEstablished);

			// If connection is not restored
			if (!connectivityEstablished) {
				console.log('[OfflineModeHandler]:', 'Connection still not restored');

				if (!this._isEnabled) {
					console.log('[OfflineModeHandler]:', 'Entering offline mode...');

					// Date on trigger offline mode
					this._startedAt = new Date(Date.now());

					// Turn offline mode on
					this._isEnabled = true;

					// Notify that offline mode is enabled
					this.emit('offline');

					isEmitted = true;

					console.log('[OfflineModeHandler]:', 'Offline mode enabled');
				}
			} else {
				// Check again before restore
				if (await networkContext.established()) {
					// Call offline mode restore routine
					this.restore();
				} else {
					console.log('Waiting...'); // or waiting
				}
			}
		} catch (error) {
			console.log('CONNECTIVITY_ERROR', error);

			if (!isEmitted) {
				// Date on trigger offline mode
				this._startedAt = new Date(Date.now());

				// Turn offline mode on
				this._isEnabled = true;

				// Notify that offline mode is enabled
				this.emit('offline');
			}
		}
	}
	/**
	 * Triggers offline mode on.
	 * @returns {void}
	 */
	public trigger(): void {
		this._pingTimer = setInterval(async () => {
			await this.connectivity();
		}, this._PING_INTERVAL);
	}

	/**
	 * Cancels offline mode
	 * @returns {void}
	 */
	public restore(): void {
		if (!this._isEnabled) {
			console.log('[OfflineModeHandler]: Connection already working, no need to restore.');
			return;
		}

		console.log('[OfflineModeHandler]: Restoring connection...');

		// Reset state
		this._isEnabled = false;

		// Notify about reconnection event
		this.emit('connection-restored');

		console.log('[OfflineModeHandler]: Connection restored');
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
