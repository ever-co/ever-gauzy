import { DESKTOP_NETWORK_ADDRESSES_CHANNEL, IDesktopNetworkAddress } from '@gauzy/contracts';
import { ipcMain } from 'electron';
import { listDesktopNetworkAddresses } from './desktop-network-addresses';

/**
 * Answers {@link DESKTOP_NETWORK_ADDRESSES_CHANNEL} in the main process with this computer's network
 * addresses ({@link listDesktopNetworkAddresses}). The setup and settings screens of Gauzy Server and
 * Gauzy API Server offer them for the "Server Hostname / IP Address" field.
 *
 * Safe to call again: the previous handler is replaced.
 */
export function registerDesktopNetworkAddressesHandler(): void {
	ipcMain.removeHandler(DESKTOP_NETWORK_ADDRESSES_CHANNEL);
	ipcMain.handle(DESKTOP_NETWORK_ADDRESSES_CHANNEL, (): IDesktopNetworkAddress[] => listDesktopNetworkAddresses());
}
