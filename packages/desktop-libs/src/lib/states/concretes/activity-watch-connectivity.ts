import { INetworkState } from '../../interfaces';
import { LocalStore } from '../../desktop-store';
import fetch from 'node-fetch';

export class ActivityWatchConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const config = LocalStore.getStore('configs');
			const res = await fetch(config.awHost + '/api');
			if (res.ok) {
				return true;
			}
			return false;
		} catch (error) {
			console.error('[ActivityWatchConnectivity]: ', error);
			return false;
		}
	}
}
