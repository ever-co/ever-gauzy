import { INetworkState } from '../../interfaces';
import { LocalStore } from '../../desktop-store';
import fetch from 'node-fetch';

export class ActivityWatchConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const config = LocalStore.getStore('configs');

			const url = config.awHost + '/api';

			console.log('[ActivityWatchConnectivity]: Checking server connectivity to url: ', url);

			const res = await fetch(url, {
				headers: {
					'Cache-Control': 'no-cache'
				},
				// node-fetch 3 removed `timeout`; an AbortSignal bounds the request the same way.
				signal: AbortSignal.timeout(5000)
			});

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
