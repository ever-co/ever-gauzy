import { powerMonitor } from 'electron';

export class DesktopEventCounter {
	private _intervalDuration: number;
	private _activeSeconds: any;
	private _intervalId: any;
	private _detectorIntervalId: any;
	private _mouseActiveDuringThisSecond: boolean;
	private _keyboardActiveDuringThisSecond: boolean;
	private _systemActiveDuringThisSecond: boolean;

	constructor() {
		/**
		 * Overall interval duration
		 * @type {Number}
		 */
		this._intervalDuration = 0;

		/**
		 * Amount of seconds with detected activity
		 * @type {Object}
		 */
		this._activeSeconds = {
			keyboard: 0,
			mouse: 0,
			system: 0
		};

		/**
		 * Identifier of the corresponding setInterval
		 * @type {Number|null}
		 */
		this._intervalId = null;

		/**
		 * Identifier of powerMonitor detector setInterval
		 * @type {Number|null}
		 */
		this._detectorIntervalId = null;

		/**
		 * Flag representing mouse activity detection during this second
		 * @type {Boolean}
		 */
		this._mouseActiveDuringThisSecond = false;

		/**
		 * Flag representing keyboard activity detection during this second
		 * @type {Boolean}
		 */
		this._keyboardActiveDuringThisSecond = false;

		/**
		 * Flag representing system activity detection during this second
		 * @type {Boolean}
		 */
		this._systemActiveDuringThisSecond = true;
	}

	/**
	 * Percentage of keyboard activity time
	 * @type {Number}
	 */
	public get keyboardPercentage(): number {
		// Avoid Infinity in results
		if (this._intervalDuration === 0 || this._activeSeconds.keyboard === 0) return 0;

		return Math.ceil(this._activeSeconds.keyboard / (this._intervalDuration / 100));
	}

	/**
	 * Percentage of mouse activity time
	 * @type {Number}
	 */
	public get mousePercentage(): number {
		// Avoid Infinity in results
		if (this._intervalDuration === 0 || this._activeSeconds.mouse === 0) return 0;

		return Math.ceil(this._activeSeconds.mouse / (this._intervalDuration / 100));
	}

	/**
	 * Percentage of system reported activity time
	 * @type {Number}
	 */
	public get systemPercentage(): number {
		// Avoid Infinity in results
		if (this._intervalDuration === 0 || this._activeSeconds.system === 0) return 0;

		return this._activeSeconds.system / this._intervalDuration;
	}

	/**
	 * Starts event tracking & counting
	 */
	public start(): void {
		console.log('DesktopEventCounter -> start -> this._intervalId', this._intervalId);
		if (this._intervalId) {
			console.log('This instance of EventCounter is already started');
			// soft fail
			return;
		}

		// Set counting interval
		this._intervalId = setInterval(() => {
			this._intervalDuration += 1;

			if (this._keyboardActiveDuringThisSecond) this._activeSeconds.keyboard += 1;

			if (this._mouseActiveDuringThisSecond) this._activeSeconds.mouse += 1;

			if (
				this._mouseActiveDuringThisSecond ||
				this._keyboardActiveDuringThisSecond ||
				this._systemActiveDuringThisSecond
			)
				this._activeSeconds.system += 1;

			this._keyboardActiveDuringThisSecond = false;
			this._mouseActiveDuringThisSecond = false;
			this._systemActiveDuringThisSecond = false;
		}, 1000);

		this._detectorIntervalId = setInterval(() => {
			if (powerMonitor.getSystemIdleTime() === 0) {
				this._systemActiveDuringThisSecond = true;
			}
		}, 1000);
	}

	/**
	 * Stops event tracker
	 */
	public stop(): void {
		console.log('DesktopEventCounter -> stop');
		if (this._intervalId) {
			clearInterval(this._intervalId);
			console.log('DesktopEventCounter -> stop -> clearInterval called');
		}

		// Resetting counters, flags, and identifiers
		this._intervalId = null;
		this._keyboardActiveDuringThisSecond = false;
		this._mouseActiveDuringThisSecond = false;

		this.reset();

		if (this._detectorIntervalId) {
			clearInterval(this._detectorIntervalId);
			this._detectorIntervalId = null;
		}
	}

	/**
	 * Resets the counters
	 */
	public reset(): void {
		this._activeSeconds.keyboard = 0;
		this._activeSeconds.mouse = 0;
		this._activeSeconds.system = 0;
		this._intervalDuration = 0;
		this._keyboardActiveDuringThisSecond = false;
		this._mouseActiveDuringThisSecond = false;
		this._systemActiveDuringThisSecond = true;
	}

	/**
	 * Getter interval duration
	 */
	public get intervalDuration(): number {
		return this._intervalDuration;
	}
}
