import { INetworkState } from '../../interfaces';
import { LocalStore } from '../../desktop-store';
import { fetch, Agent } from 'undici';

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

export class ApiServerConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const url = LocalStore.getServerUrl() + '/api';

			console.log('[ApiServerConnectivity]: Checking server connectivity to url: ', url);

			// if more than 30 sec to get response, then we think no connectivity for now to API servers
			const res = await fetch(url, {
				headers: {
					'Cache-Control': 'no-cache'
				},
				dispatcher: new Agent({
					connect: {
						timeout: 30 * 1000
					}
				})
			});

			if (res?.ok && res?.status === 200) {
				const data = await res.json();
				console.log('[ApiServerConnectivity]: Server connectivity check response: ', data);

				return true;
			} else {
				console.log('[ApiServerConnectivity]: Server connectivity failed: ', res?.statusText);
			}

			return false;
		} catch (error) {
			console.error('[ApiServerConnectivity]: ', error);
			return false;
		}
	}
}
