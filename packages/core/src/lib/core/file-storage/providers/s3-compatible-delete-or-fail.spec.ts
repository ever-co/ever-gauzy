/**
 * `deleteFile` of the DigitalOcean and Wasabi providers only warns and resolves when no client can be built (the
 * credentials are missing), so a caller cannot tell a deleted file from one left in the bucket. `deleteFileOrFail`,
 * which account deletion uses to report what it could not remove, throws there instead.
 */
jest.mock('@gauzy/config', () => ({
	environment: { baseUrl: 'http://localhost:3000', isElectron: false, digitalOcean: {}, wasabi: {} },
	getConfig: () => ({ assetOptions: {} })
}));
jest.mock('../../context', () => ({ RequestContext: { currentRequest: () => null } }));

import { Logger } from '@nestjs/common';
import { DigitalOceanS3Provider } from './digitalocean-s3.provider';
import { WasabiS3Provider } from './wasabi-s3.provider';

describe.each([
	['DigitalOcean', DigitalOceanS3Provider, 'getDigitalOceanInstance'],
	['Wasabi', WasabiS3Provider, 'getWasabiInstance']
] as const)('%s provider: deleting a file it cannot reach', (label, ProviderClass, getter) => {
	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => jest.restoreAllMocks());

	/** The provider's methods, on an instance whose client could not be built. */
	const unreachable = () => {
		const provider = Object.create(ProviderClass.prototype);

		// `Object.create` skips the constructor, and with it the instance's logger.
		provider.logger = new Logger(label);
		jest.spyOn(provider, getter as never).mockReturnValue(null as never);

		return provider as InstanceType<typeof ProviderClass>;
	};

	it('deleteFile resolves without deleting, as its best-effort callers expect', async () => {
		await expect(unreachable().deleteFile('uploads/a.png')).resolves.toBeUndefined();
	});

	it('deleteFileOrFail throws, so the caller counts the file as not removed', async () => {
		await expect(unreachable().deleteFileOrFail('uploads/a.png')).rejects.toThrow(
			`The file "uploads/a.png" was not deleted: ${label} storage is not configured.`
		);
	});

	it('deleteFileOrFail deletes through deleteFile when a client is there', async () => {
		const provider = Object.create(ProviderClass.prototype);
		const deleteFile = jest.fn().mockResolvedValue({ status: 200 });

		jest.spyOn(provider, getter as never).mockReturnValue({} as never);
		provider.deleteFile = deleteFile;

		await expect(provider.deleteFileOrFail('uploads/a.png')).resolves.toBeUndefined();
		expect(deleteFile).toHaveBeenCalledWith('uploads/a.png');
	});
});
