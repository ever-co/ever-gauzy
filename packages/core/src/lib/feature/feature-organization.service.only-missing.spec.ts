/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before the services (and the repositories they import) are evaluated.
 */
import '../core/entities/internal';
import { FeatureOrganizationService } from './feature-organization.service';

/**
 * Completing the tenant-wide feature toggles of a tenant an earlier, failed onboarding created.
 *
 * `SeedCoreFeatures1791000000510` gives every tenant, empty ones included, its default-on toggles, so such a
 * tenant can hold some toggles without having all of them. The `onlyMissing` mode creates the missing ones
 * and keeps the existing toggles (and whatever they are set to) as they are.
 */

const TENANT = { id: '11111111-1111-4111-8111-111111111111' } as any;
const FEATURES = [
	{ id: 'feature-a', isEnabled: true },
	{ id: 'feature-b', isEnabled: false },
	{ id: 'feature-c', isEnabled: true }
];

function buildService(held: Array<{ featureId: string; organizationId?: string | null }>) {
	const service: any = Object.create(FeatureOrganizationService.prototype);
	service._featureService = { find: jest.fn(async () => FEATURES) };
	service.find = jest.fn(async () => held.map((row) => ({ tenantId: TENANT.id, ...row })));
	service.saveManyWithoutEnrichment = jest.fn(async (rows: any[]) => rows);
	return service;
}

describe('FeatureOrganizationService.updateTenantFeatureOrganizations', () => {
	it('creates a toggle for every feature, without reading existing rows, by default', async () => {
		const service = buildService([]);

		const rows = await service.updateTenantFeatureOrganizations([TENANT]);

		expect(service.find).not.toHaveBeenCalled();
		expect(rows.map((row: any) => row.feature.id)).toEqual(['feature-a', 'feature-b', 'feature-c']);
	});

	it('creates only the tenant-wide toggles the tenant is missing', async () => {
		const service = buildService([
			{ featureId: 'feature-a', organizationId: null },
			// An organization's own toggle does not stand in for the tenant-wide one.
			{ featureId: 'feature-c', organizationId: 'organization-1' }
		]);

		const rows = await service.updateTenantFeatureOrganizations([TENANT], { onlyMissing: true });

		expect(service.find).toHaveBeenCalledWith({ where: { tenantId: TENANT.id }, withDeleted: true });
		expect(rows.map((row: any) => row.feature.id)).toEqual(['feature-b', 'feature-c']);
		expect(rows.map((row: any) => row.isEnabled)).toEqual([false, true]);
	});

	it('writes nothing when the tenant has every toggle', async () => {
		const service = buildService(FEATURES.map(({ id }) => ({ featureId: id, organizationId: null })));

		await expect(service.updateTenantFeatureOrganizations([TENANT], { onlyMissing: true })).resolves.toEqual([]);
		expect(service.saveManyWithoutEnrichment).not.toHaveBeenCalled();
	});
});
