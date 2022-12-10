export interface IOfflineMode {
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
}
