import { INetworkState } from '../../interfaces';
import { LocalStore } from '../../desktop-store';
import fetch from 'node-fetch';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

export class ApiServerConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const res = await fetch(LocalStore.getServerUrl() + '/api');
			if (res.ok) {
				return true;
			}
			return false;
		} catch (error) {
			console.error('[ApiServerConnectivity]: ', error);
			return false;
		}
	}
}
