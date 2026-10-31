const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockIpcMain = {
	handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
		if (mockHandlers.has(channel)) {
			// Electron throws when a channel gets a second handler.
			throw new Error(`Attempted to register a second handler for '${channel}'`);
		}
		mockHandlers.set(channel, handler);
	}),
	removeHandler: jest.fn((channel: string) => mockHandlers.delete(channel))
};
jest.mock('electron', () => ({ ipcMain: mockIpcMain }), { virtual: true });
jest.mock('./desktop-network-addresses', () => ({
	listDesktopNetworkAddresses: () => [{ name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false }]
}));

import { DESKTOP_NETWORK_ADDRESSES_CHANNEL } from '@gauzy/contracts';
import { registerDesktopNetworkAddressesHandler } from './desktop-network-ipc';

describe('registerDesktopNetworkAddressesHandler', () => {
	beforeEach(() => mockHandlers.clear());

	it('answers the network addresses channel with the computer’s addresses', () => {
		registerDesktopNetworkAddressesHandler();

		expect(DESKTOP_NETWORK_ADDRESSES_CHANNEL).toBe('GET_NETWORK_ADDRESSES');
		expect(mockHandlers.get(DESKTOP_NETWORK_ADDRESSES_CHANNEL)?.()).toEqual([
			{ name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false }
		]);
	});

	it('can be called again (a second window, a restart of the IPC setup) without throwing', () => {
		registerDesktopNetworkAddressesHandler();

		expect(() => registerDesktopNetworkAddressesHandler()).not.toThrow();
		expect(mockHandlers.has(DESKTOP_NETWORK_ADDRESSES_CHANNEL)).toBe(true);
	});
});
