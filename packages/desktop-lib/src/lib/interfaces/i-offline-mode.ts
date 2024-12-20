export interface IOfflineMode {
	/**
	 * Offline mode start at
	 * @returns {Date}
	 */
	startedAt: Date;
	/**
	 * Offline mode end at
	 * @returns {Date}
	 */
	stoppedAt: Date;
	/**
	 * Triggers Offline mode
	 *  @return {void}
	 */
	trigger(): void;
	/**
	 * Cancels offline mode
	 * @return {void}
	 */
	restore(): void;
	/**
	 * Returns status of offline mode (true is enabled)
	 * @return {boolean} Is offline mode enabled
	 */
	get enabled(): boolean;
	/**
	 *  Returns a reference to the `EventEmitter`, so that calls can be chained.
	 * @param eventName
	 * @param listener
	 */
	on(eventName: string | symbol, listener: (...args: any[]) => void): this;
	/**
	 * Check api connectivity
	 */
	connectivity(): Promise<void>;
}
