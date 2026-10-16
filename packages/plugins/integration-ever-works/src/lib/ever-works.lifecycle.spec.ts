// The catalog service reads core's entities; the lifecycle only needs something with `ensure()`.
jest.mock('./ever-works-catalog.service', () => ({ EverWorksCatalogService: class EverWorksCatalogService {} }));

import { Logger } from '@nestjs/common';
import { EverWorksLifecycle } from './ever-works.lifecycle';

describe('EverWorksLifecycle', () => {
	let log: jest.SpyInstance;
	let warn: jest.SpyInstance;

	beforeEach(() => {
		log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['unset', {}],
		['false', { EVER_WORKS_ENABLED: 'false' }],
		['TRUE', { EVER_WORKS_ENABLED: 'TRUE' }]
	])('writes nothing when the switch reads %s at run time', async (_name, env) => {
		const catalog = { ensure: jest.fn() };
		await new EverWorksLifecycle(catalog as never, env).onApplicationBootstrap();
		expect(catalog.ensure).not.toHaveBeenCalled();
		expect(log).not.toHaveBeenCalled();
	});

	it('lists the integration in the catalog when switched on', async () => {
		const catalog = { ensure: jest.fn().mockResolvedValue({}) };
		await new EverWorksLifecycle(catalog as never, { EVER_WORKS_ENABLED: 'true' }).onApplicationBootstrap();
		expect(catalog.ensure).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(expect.stringContaining('EVER_WORKS_ENABLED=true'));
	});

	it('never stops the API when the catalog cannot be written', async () => {
		const catalog = { ensure: jest.fn().mockRejectedValue(new TypeError('no such table: integration')) };
		await expect(
			new EverWorksLifecycle(catalog as never, { EVER_WORKS_ENABLED: 'true' }).onApplicationBootstrap()
		).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('TypeError'));
		// The error message (which could carry SQL or data) is not logged.
		expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('no such table'));
	});
});
