import { INetworkState } from '../interfaces';

export class NetworkStateManager {
	private _state: INetworkState;

	constructor(state?: INetworkState) {
		this._state = state;
	}

	public set state(value: INetworkState) {
		this._state = value;
	}
	/**
	 * Check connectivity
	 * @return {Boolean} True if connectivity is established
	 */
	public async established(): Promise<boolean> {
		return await this._state.established();
	}
}
