import '../../core/entities/internal';

import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';

/**
 * Under MikroORM, saving settings wrote back serialized copies of the existing ones: plain objects, which
 * `persistAndFlush` rejects as undiscovered entities, so saving any setting that already existed failed.
 */
describe('TenantSettingService saves (MikroORM)', () => {
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
		[
			'saveSettings',
			(service: TenantSettingService) => service.saveSettings({ theme: 'dark', locale: 'fr' }, 'tenant-1')
		],
		[
			'saveGlobalSettings',
			(service: TenantSettingService) => service.saveGlobalSettings({ theme: 'dark', locale: 'fr' })
		]
	])('%s writes the managed entity of an existing setting, with its new value', async (_, save) => {
		const existing = new TenantSetting({ name: 'theme', value: 'light', tenantId: 'tenant-1' });
		const { service, persistAndFlush } = build([existing]);

		const result = await save(service);

		const written = persistAndFlush.mock.calls[0][0];
		expect(written[0]).toBe(existing);
		expect(existing.value).toBe('dark');
		expect(written[1]).toBeInstanceOf(TenantSetting);
		expect(result).toEqual({ theme: 'dark', locale: 'fr' });
	});
});
