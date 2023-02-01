import { INetworkState } from '../../interfaces';
import fetch, { Headers } from 'node-fetch';

export class InternetConnectivity implements INetworkState {
	public async established(): Promise<boolean> {
		try {
			const headers = new Headers();
			headers.append('Cache-Control', 'no-cache');
			const res = await fetch('https://www.google.com');
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
