import { rimraf } from 'rimraf';
import { cleanAssets } from './utils';
import { SeedDataService } from './seed-data.service';

jest.mock('rimraf', () => ({ rimraf: jest.fn() }));

/**
 * A failed cleanup of generated seed files never stopped a seed: rimraf 3 took the failure callback for its options
 * argument and called the success one either way. rimraf 6 returns a promise that rejects, so each caller has to
 * handle the rejection itself - including not leaving it unhandled, which ends a Node process.
 */
describe('seed cleanup of generated files', () => {
	const config = { assetOptions: { assetPublicPath: '/srv/gauzy/public' } } as any;
	const failure = Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
	let unhandled: unknown[];
	const onUnhandled = (reason: unknown) => unhandled.push(reason);

	beforeEach(() => {
		unhandled = [];
		process.on('unhandledRejection', onUnhandled);
		(rimraf as unknown as jest.Mock).mockReset().mockRejectedValue(failure);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		process.off('unhandledRejection', onUnhandled);
		jest.restoreAllMocks();
	});

	/** Lets any rejection nobody handled reach the process's `unhandledRejection` event. */
	const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

	it('cleanAssets resolves when the cleanup fails, and reports the failure', async () => {
		await expect(cleanAssets(config, 'ever-icons')).resolves.toBeUndefined();
		await settle();

		expect(rimraf).toHaveBeenCalledTimes(1);
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('EBUSY'));
		expect(unhandled).toEqual([]);
	});

	it('the seed service cleanup resolves when the cleanup fails, and leaves no unhandled rejection', async () => {
		const service = new SeedDataService({} as any, config);

		await expect((service as any).cleanUpPreviousRuns()).resolves.toBeUndefined();
		await settle();

		expect(rimraf).toHaveBeenCalledTimes(1);
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('COULD NOT CLEAN UP'));
		expect(unhandled).toEqual([]);
	});

	it('CONTROL: a successful cleanup still says so', async () => {
		(rimraf as unknown as jest.Mock).mockResolvedValue(true);
		const service = new SeedDataService({} as any, config);

		await expect((service as any).cleanUpPreviousRuns()).resolves.toBeUndefined();
		await expect(cleanAssets(config, 'ever-icons')).resolves.toBeUndefined();

		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CLEANED UP'));
		expect(console.error).not.toHaveBeenCalled();
	});
});
