import '../../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { CrudService } from '../../core/crud/crud.service';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TenantSettingSaveCommand } from './commands';
import { TenantSettingSaveHandler } from './commands/handlers/tenant-setting.save.handler';
import { OPERATOR_USER_IDS_ENV } from './global-setting-writer';
import { TenantSettingService } from './tenant-setting.service';

const ORG = 'a0000000-0000-4000-8000-00000000000a';
const QUOTA = `docs.${ORG}.quotaBytes`;
const QUOTA_ROW = { id: 'b0000000-0000-4000-8000-00000000000b', name: QUOTA, value: '1073741824' };
const UI_ROW = { id: 'c0000000-0000-4000-8000-00000000000c', name: 'preferredUi', value: 'teams' };

/**
 * An organization's Documents storage limit is the row `docs.<organizationId>.quotaBytes` of the tenant's settings,
 * and every tenant admin holds `TENANT_SETTING`. Before, `POST /tenant-setting/dynamic {"docs.<org>.quotaBytes":"0"}`
 * (and `updateDynamicTenantSetting`) lifted the limit, and the row routes the CRUD controller gives `/tenant-setting`
 * (`PUT :id`, `DELETE :id`, `DELETE :id/soft`, `PUT :id/recover`, and their GraphQL fields) changed it, renamed
 * another row to it, or removed it so the deployment default applied again. Owner decision 14 (2026-10-22): only the
 * installation operator — a super admin listed in `EVER_OPERATOR_USER_IDS` — writes it.
 */
describe('TenantSetting — the Documents storage limit is the installation operator’s to write', () => {
	const savedList = process.env[OPERATOR_USER_IDS_ENV];

	const signIn = (userId: string, role: RolesEnum) => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
		jest.spyOn(RequestContext, 'hasRole').mockImplementation((asked: RolesEnum) => asked === role);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	};
	const asTenantAdmin = () => signIn('admin-1', RolesEnum.SUPER_ADMIN);
	const asOperator = () => {
		process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';
		signIn('operator-1', RolesEnum.SUPER_ADMIN);
	};

	const buildService = (rows: Record<string, unknown>[] = []) => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const service = new TenantSettingService(
			{ metadata: { tableName: 'tenant_setting' }, manager: {} } as any,
			{ getEntityManager: () => ({}) } as any
		);
		const find = jest.spyOn(service, 'find').mockResolvedValue(rows as any);
		return { service, find };
	};

	beforeEach(() => {
		delete process.env[OPERATOR_USER_IDS_ENV];
	});

	afterEach(() => {
		if (savedList === undefined) delete process.env[OPERATOR_USER_IDS_ENV];
		else process.env[OPERATOR_USER_IDS_ENV] = savedList;
		jest.restoreAllMocks();
	});

	describe('the settings document (POST /, POST /dynamic and their GraphQL fields)', () => {
		const build = () => {
			const { service } = buildService();
			const save = jest.spyOn(service, 'saveSettings').mockResolvedValue({} as any);
			return { handler: new TenantSettingSaveHandler(service), save };
		};

		it("refuses a tenant's super admin the storage limit, before saving anything", async () => {
			asTenantAdmin();
			const { handler, save } = build();

			await expect(handler.execute(new TenantSettingSaveCommand({ [QUOTA]: '0' } as any))).rejects.toBeInstanceOf(
				ForbiddenException
			);
			await expect(
				handler.execute(
					new TenantSettingSaveCommand({ preferredUi: 'teams', [QUOTA.toUpperCase()]: '0' } as any)
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		});

		it('saves the other settings, the other Documents defaults included, as before', async () => {
			asTenantAdmin();
			const { handler, save } = build();
			const input = { preferredUi: 'teams', [`docs.${ORG}.autoClassify`]: 'false' } as any;

			await handler.execute(new TenantSettingSaveCommand(input));

			expect(save).toHaveBeenCalledWith(input, 'tenant-1');
		});

		it('saves the storage limit for the operator', async () => {
			asOperator();
			const { handler, save } = build();

			await handler.execute(new TenantSettingSaveCommand({ [QUOTA]: '0' } as any));

			expect(save).toHaveBeenCalledWith({ [QUOTA]: '0' }, 'tenant-1');
		});
	});

	describe('the row writes (PUT :id, DELETE :id, DELETE :id/soft, PUT :id/recover, POST /)', () => {
		it("refuses a tenant's super admin a change of the storage limit row, and changes nothing", async () => {
			asTenantAdmin();
			const { service, find } = buildService([QUOTA_ROW]);
			const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as any);

			await expect(service.update(QUOTA_ROW.id, { value: '0' })).rejects.toBeInstanceOf(ForbiddenException);

			expect(find).toHaveBeenCalledWith({ where: { id: QUOTA_ROW.id }, withDeleted: true });
			expect(update).not.toHaveBeenCalled();
		});

		it('refuses renaming another row to the storage limit', async () => {
			asTenantAdmin();
			const { service } = buildService([UI_ROW]);
			const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as any);

			await expect(service.update(UI_ROW.id, { name: QUOTA, value: '0' })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(update).not.toHaveBeenCalled();
		});

		it('updates the other rows, as before, and the storage limit row for the operator', async () => {
			asTenantAdmin();
			const { service } = buildService([UI_ROW]);
			const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as any);

			await service.update(UI_ROW.id, { value: 'gauzy' });
			expect(update).toHaveBeenCalledWith(UI_ROW.id, { value: 'gauzy' });

			jest.restoreAllMocks();
			asOperator();
			const operator = buildService([QUOTA_ROW]);
			const operatorUpdate = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as any);

			await operator.service.update(QUOTA_ROW.id, { value: '0' });
			expect(operatorUpdate).toHaveBeenCalledWith(QUOTA_ROW.id, { value: '0' });
		});

		it("refuses a tenant's super admin removing the storage limit row, which would put the default back", async () => {
			asTenantAdmin();
			const { service } = buildService([QUOTA_ROW]);
			const remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({} as any);
			const softRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({} as any);

			await expect(service.delete(QUOTA_ROW.id)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.softRemove(QUOTA_ROW.id)).rejects.toBeInstanceOf(ForbiddenException);

			expect(remove).not.toHaveBeenCalled();
			expect(softRemove).not.toHaveBeenCalled();
		});

		it('refuses bringing a soft-deleted storage limit row back, reading soft-deleted rows', async () => {
			asTenantAdmin();
			const { service, find } = buildService([QUOTA_ROW]);
			const softRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({} as any);

			await expect(service.softRecover(QUOTA_ROW.id)).rejects.toBeInstanceOf(ForbiddenException);

			expect(find).toHaveBeenCalledWith({ where: { id: QUOTA_ROW.id }, withDeleted: true });
			expect(softRecover).not.toHaveBeenCalled();
		});

		it('removes and brings back the other rows, as before', async () => {
			asTenantAdmin();
			const { service } = buildService([UI_ROW]);
			const remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({} as any);
			const softRemove = jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({} as any);
			const softRecover = jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({} as any);

			await service.delete(UI_ROW.id);
			await service.softRemove(UI_ROW.id);
			await service.softRecover(UI_ROW.id);

			expect(remove).toHaveBeenCalledWith(UI_ROW.id, undefined);
			expect(softRemove).toHaveBeenCalled();
			expect(softRecover).toHaveBeenCalled();
		});

		it("refuses creating the storage limit row through the CRUD controller's POST", async () => {
			asTenantAdmin();
			const { service } = buildService();
			const create = jest.spyOn(TenantAwareCrudService.prototype, 'create').mockResolvedValue({} as any);

			await expect(service.create({ name: QUOTA, value: '0' })).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('answers a row it cannot read as missing, never writing it unchecked', async () => {
			asTenantAdmin();
			const { service, find } = buildService();
			find.mockRejectedValue(new Error('invalid input syntax for type uuid'));
			const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as any);

			await expect(service.update('not-a-uuid', { value: '0' })).rejects.toBeInstanceOf(NotFoundException);
			expect(update).not.toHaveBeenCalled();
		});
	});
});
