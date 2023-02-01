export interface INetworkState {
	/**
	 * Check connectivity
	 * @return {Boolean} True if connectivity is established
	 */
	established(): Promise<boolean>;
}
