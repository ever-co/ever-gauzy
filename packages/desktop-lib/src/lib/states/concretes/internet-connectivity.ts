import { INetworkState } from '../../interfaces';
import { Agent, fetch, Headers } from 'undici';

export class InternetConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			console.log('[InternetConnectivity]: Checking internet connectivity...');

			const headers = new Headers();
			headers.append('Cache-Control', 'no-cache');

			const res = await fetch('https://www.google.com', {
				headers,
				dispatcher: new Agent({
					connect: {
						timeout: 30 * 1000
					}
				})
			});

			if (res.ok) {
				return true;
			}

			return false;
		} catch (error) {
			console.error('[InternetConnectivity]: ', error);
			return false;
		}
	}
}
