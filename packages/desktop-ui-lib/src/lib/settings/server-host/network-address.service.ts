import { inject, Injectable } from '@angular/core';
import { DESKTOP_NETWORK_ADDRESSES_CHANNEL, IDesktopNetworkAddress } from '@gauzy/contracts';
import { ElectronService, LoggerService } from '../../electron/services';

/**
 * This computer's network addresses, read by the main process of Gauzy Server and Gauzy API Server
 * from the operating system (no online lookup, so a public address held by a router is not found).
 */
@Injectable({
	providedIn: 'root'
})
export class NetworkAddressService {
	private readonly electronService = inject(ElectronService);
	private readonly loggerService = inject(LoggerService);

	/**
	 * The addresses, best candidate for the "Server Hostname / IP Address" setting first. Empty when
	 * the computer has none or the app cannot list them (an app whose main process has no handler).
	 */
	public async list(): Promise<IDesktopNetworkAddress[]> {
		try {
			const addresses: unknown = await this.electronService.ipcRenderer?.invoke(DESKTOP_NETWORK_ADDRESSES_CHANNEL);
			return Array.isArray(addresses) ? addresses.filter(isNetworkAddress) : [];
		} catch (error) {
			this.loggerService.warn('Cannot list the network addresses', error);
			return [];
		}
	}
}

function isNetworkAddress(value: unknown): value is IDesktopNetworkAddress {
	const address = value as IDesktopNetworkAddress;
	return (
		typeof address?.address === 'string' &&
		!!address.address &&
		(address.family === 'IPv4' || address.family === 'IPv6') &&
		typeof address.name === 'string'
	);
}
