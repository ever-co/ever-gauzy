import { TestBed } from '@angular/core/testing';
import { DESKTOP_NETWORK_ADDRESSES_CHANNEL } from '@gauzy/contracts';
import { ElectronService, LoggerService } from '../../electron/services';
import { NetworkAddressService } from './network-address.service';

describe('NetworkAddressService', () => {
	let invoke: jest.Mock;
	let warn: jest.Mock;
	let service: NetworkAddressService;

	beforeEach(() => {
		invoke = jest.fn();
		warn = jest.fn();
		TestBed.configureTestingModule({
			providers: [
				{ provide: ElectronService, useValue: { ipcRenderer: { invoke } } },
				{ provide: LoggerService, useValue: { warn } }
			]
		});
		service = TestBed.inject(NetworkAddressService);
	});

	it('asks the main process for the addresses', async () => {
		const lan = { name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false };
		invoke.mockResolvedValue([lan]);

		await expect(service.list()).resolves.toEqual([lan]);
		expect(invoke).toHaveBeenCalledWith(DESKTOP_NETWORK_ADDRESSES_CHANNEL);
	});

	it('drops entries that are not addresses', async () => {
		const lan = { name: 'Wi-Fi', address: '192.168.1.20', family: 'IPv4', virtual: false };
		invoke.mockResolvedValue([lan, null, { name: 'x', address: '', family: 'IPv4' }, { name: 'y', address: '1.2.3.4' }]);

		await expect(service.list()).resolves.toEqual([lan]);
	});

	it('returns no address when the main process answers nothing', async () => {
		invoke.mockResolvedValue(undefined);

		await expect(service.list()).resolves.toEqual([]);
	});

	it('returns no address, and logs why, when the app has no handler for the channel', async () => {
		invoke.mockRejectedValue(new Error(`No handler registered for '${DESKTOP_NETWORK_ADDRESSES_CHANNEL}'`));

		await expect(service.list()).resolves.toEqual([]);
		expect(warn).toHaveBeenCalled();
	});
});
