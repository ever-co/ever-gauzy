import { fetch, Agent } from 'undici';
import * as dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { INetworkState } from '../../interfaces';
import { LocalStore } from '../../desktop-store';
import { API_PROBE_TIMEOUT_MS } from '../../offline/connectivity-timing';

export class ApiServerConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const url = LocalStore.getServerUrl() + '/api';

			console.log('[ApiServerConnectivity]: Checking server connectivity to url: ', url);

			// No answer within API_PROBE_TIMEOUT_MS (connecting, or answering once connected): no connectivity to the
			// API for now. The whole probe is bounded, so a lost connection is noticed within the detection budget.
			const res = await fetch(url, {
				headers: {
					'Cache-Control': 'no-cache'
				},
				dispatcher: new Agent({
					connect: {
						timeout: API_PROBE_TIMEOUT_MS
					}
				}),
				signal: AbortSignal.timeout(API_PROBE_TIMEOUT_MS)
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
