import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { CrudService } from '../../core/crud/crud.service';
import { RequestContext } from '../../core/context';
import { Tenant } from '../../core/entities/internal';
import { MultiORMEnum } from '../../core/utils';
import { GlobalSettingSaveCommand } from './commands';
import { GlobalSettingSaveHandler } from './commands/handlers/global-setting.save.handler';
import { DynamicSettingDTO } from './dto/dynamic-setting.dto';
import { OPERATOR_USER_IDS_ENV } from './global-setting-writer';
import { TenantSettingService } from './tenant-setting.service';

/**
 * `POST /tenant-setting/global` and the `saveGlobalTenantSetting` mutation both dispatch `GlobalSettingSaveCommand`.
 * Their `GLOBAL_SETTING` permission is a default of every tenant's super admin, so the handler lets only the
 * operator of the installation write the rows every tenant falls back to.
 */
describe('GlobalSettingSaveHandler', () => {
	const savedList = process.env[OPERATOR_USER_IDS_ENV];

	const build = (ormType: MultiORMEnum, tenantCount: number) => {
		const typeOrmCount = jest.fn().mockResolvedValue(tenantCount);
		const mikroOrmCount = jest.fn().mockResolvedValue(tenantCount);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		const service = new TenantSettingService(
			{ metadata: { tableName: 'tenant_setting' }, manager: { count: typeOrmCount } } as any,
			{ getEntityManager: () => ({ count: mikroOrmCount }) } as any
		);
		const save = jest.spyOn(service, 'saveGlobalSettings').mockResolvedValue({});
		return { handler: new GlobalSettingSaveHandler(service), save, typeOrmCount, mikroOrmCount };
	};

	// Typed as the route's body: `ITenantSetting` lists only the file-storage settings, and the route takes any name.
	const input: DynamicSettingDTO = { posthogHost: 'https://collector.example.org' };
	const command = () => new GlobalSettingSaveCommand(input);

	beforeEach(() => {
		delete process.env[OPERATOR_USER_IDS_ENV];
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => {
		if (savedList === undefined) delete process.env[OPERATOR_USER_IDS_ENV];
		else process.env[OPERATOR_USER_IDS_ENV] = savedList;
		jest.restoreAllMocks();
	});

	it.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
		'refuses the super admin of one tenant among several, before saving anything (%s)',
		async (ormType) => {
			const { handler, save } = build(ormType, 2);

			await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		}
	);

	it('counts the tenants of the installation (TypeORM)', async () => {
		const { handler, typeOrmCount } = build(MultiORMEnum.TypeORM, 1);

		await handler.execute(command());

		expect(typeOrmCount).toHaveBeenCalledWith(Tenant);
	});

	it('counts the tenants of the installation (MikroORM)', async () => {
		const { handler, mikroOrmCount } = build(MultiORMEnum.MikroORM, 1);

		await handler.execute(command());

		expect(mikroOrmCount).toHaveBeenCalledWith(Tenant, {});
	});

	it('saves for the super admin of a single-tenant installation, as before', async () => {
		const { handler, save } = build(MultiORMEnum.TypeORM, 1);

		await handler.execute(command());

		expect(save).toHaveBeenCalledWith({ posthogHost: 'https://collector.example.org' });
	});

	it('saves for an operator listed in EVER_OPERATOR_USER_IDS, however many tenants there are', async () => {
		process.env[OPERATOR_USER_IDS_ENV] = 'user-1';
		const { handler, save } = build(MultiORMEnum.TypeORM, 40);

		await handler.execute(command());

		expect(save).toHaveBeenCalled();
	});

	it('refuses a super admin the list does not name', async () => {
		process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';
		const { handler, save } = build(MultiORMEnum.TypeORM, 1);

		await expect(handler.execute(command())).rejects.toBeInstanceOf(ForbiddenException);
		expect(save).not.toHaveBeenCalled();
	});
});
