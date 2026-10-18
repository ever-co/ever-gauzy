import '../../core/entities/internal';

import { FileStorageProviderEnum, ITenantSetting } from '@gauzy/contracts';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

/**
 * Under MikroORM, saving settings wrote back serialized copies of the existing ones: plain objects, which
 * `persistAndFlush` rejects as undiscovered entities, so saving any setting that already existed failed.
 */
describe('TenantSettingService saves (MikroORM)', () => {
	/** Two settings of the shape `ITenantSetting` describes: one that exists already, one that is new. */
	const input: ITenantSetting = { fileStorageProvider: FileStorageProviderEnum.S3, aws_default_region: 'eu-west-1' };

	const build = (existing: TenantSetting[]) => {
		const persistAndFlush = jest.fn();
		const mikroOrmRepository = {
			find: jest.fn().mockResolvedValue(existing),
			getEntityManager: () => ({ persistAndFlush })
		};
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		const service = new TenantSettingService(
			{ metadata: { tableName: 'tenant_setting' } } as any,
			mikroOrmRepository as any
		);
		// A serialized copy is a plain object, as `wrap(entity).toJSON()` gives
		jest.spyOn(service as any, 'serialize').mockImplementation((entity: any) => ({ ...entity }));
		return { service, persistAndFlush };
	};

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['saveSettings', (service: TenantSettingService) => service.saveSettings(input, 'tenant-1')],
		['saveGlobalSettings', (service: TenantSettingService) => service.saveGlobalSettings(input)]
	])('%s writes the managed entity of an existing setting, with its new value', async (_, save) => {
		const existing = new TenantSetting({
			name: 'fileStorageProvider',
			value: FileStorageProviderEnum.LOCAL,
			tenantId: 'tenant-1'
		});
		const { service, persistAndFlush } = build([existing]);

		const result = await save(service);

		const written = persistAndFlush.mock.calls[0][0];
		expect(written[0]).toBe(existing);
		expect(existing.value).toBe(FileStorageProviderEnum.S3);
		expect(written[1]).toBeInstanceOf(TenantSetting);
		expect(result).toEqual({ fileStorageProvider: FileStorageProviderEnum.S3, aws_default_region: 'eu-west-1' });
	});
});
