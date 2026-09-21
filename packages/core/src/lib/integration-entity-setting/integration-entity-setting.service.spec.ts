// Must stay first: loads the entity graph before the services pull an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IntegrationEntitySettingTiedService } from '../integration-entity-setting-tied/integration-entity-setting-tied.service';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';

/**
 * GHSA-jh6m-9fxr-rx3c — PUT /integration-entity-setting(-tied)/integration/:id.
 *
 * Both handlers only checked that the PATH integration was the caller's, then handed the raw body to
 * `typeOrmRepository.save()`: no tenant stamping, no foreign-id check, and the body could name any
 * integration. The services now go through TenantAwareCrudService.saveMany (tenant stamp + root and
 * nested foreign-id checks) and pin every item to the route's integration.
 *
 * CONTROL: the raw repository `save` is a spy that must never be called any more — it is exactly what
 * the pre-fix services called with the body.
 */

const TENANT_A = 'tenant-a';

describe('integration entity settings bulk upsert (GHSA-jh6m-9fxr-rx3c)', () => {
	let saveMany: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		saveMany = jest
			.spyOn(TenantAwareCrudService.prototype, 'saveMany')
			.mockImplementation(async (entities: any[]) => entities);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('IntegrationEntitySettingService', () => {
		it('pins every item to the route integration and saves through the tenant-aware saveMany', async () => {
			const repository = { save: jest.fn() };
			const service = new IntegrationEntitySettingService(repository as any, {} as any);

			await service.bulkUpdateOrCreate('integration-a', [
				{ id: 'setting-1', entity: 'Project', sync: true, integrationId: 'integration-other' },
				{ entity: 'Task', sync: false, integration: { id: 'integration-other' } }
			] as any);

			expect(repository.save).not.toHaveBeenCalled();
			const saved = saveMany.mock.calls[0][0];
			expect(saved.map((item: any) => item.integrationId)).toEqual(['integration-a', 'integration-a']);
			expect(saved.every((item: any) => !('integration' in item))).toBe(true);
			expect(saved[0]).toMatchObject({ id: 'setting-1', entity: 'Project', sync: true });
		});

		it('accepts a single object as before', async () => {
			const service = new IntegrationEntitySettingService({ save: jest.fn() } as any, {} as any);

			await service.bulkUpdateOrCreate('integration-a', { entity: 'Project', sync: true } as any);

			expect(saveMany.mock.calls[0][0]).toEqual([{ entity: 'Project', sync: true, integrationId: 'integration-a' }]);
		});
	});

	describe('IntegrationEntitySettingTiedService', () => {
		const createTiedService = (parentsInIntegration: number) => {
			const count = jest.fn(async (..._args: any[]) => parentsInIntegration);
			const repository = { save: jest.fn(), manager: { count } };
			const service = new IntegrationEntitySettingTiedService(repository as any, {} as any);
			return { service, repository, count };
		};

		it("refuses a parent setting that is not one of the route integration's settings", async () => {
			const { service, repository, count } = createTiedService(0);

			await expect(
				service.bulkUpdateOrCreate('integration-a', [
					{ entity: 'Label', sync: true, integrationEntitySettingId: 'setting-of-another-integration' }
				] as any)
			).rejects.toThrow(ForbiddenException);

			expect(count.mock.calls[0][1]).toMatchObject({
				where: { integrationId: 'integration-a', tenantId: TENANT_A }
			});
			expect(repository.save).not.toHaveBeenCalled();
			expect(saveMany).not.toHaveBeenCalled();
		});

		it('saves through the tenant-aware saveMany when every parent belongs to the integration', async () => {
			const { service, repository } = createTiedService(1);

			await service.bulkUpdateOrCreate('integration-a', [
				{ entity: 'Label', sync: true, integrationEntitySetting: { id: 'setting-1', entity: 'Issue' } }
			] as any);

			expect(repository.save).not.toHaveBeenCalled();
			expect(saveMany.mock.calls[0][0]).toEqual([
				{ entity: 'Label', sync: true, integrationEntitySettingId: 'setting-1' }
			]);
		});
	});
});
