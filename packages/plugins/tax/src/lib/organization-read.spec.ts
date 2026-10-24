import { NotFoundException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxCategoryService } from './tax-category/tax-category.service';
import { TaxRatePartService } from './tax-rate-part/tax-rate-part.service';
import { TaxRateService } from './tax-rate/tax-rate.service';
import { TaxRegimeRateService } from './tax-regime-rate/tax-regime-rate.service';
import { TaxRegimeService } from './tax-regime/tax-regime.service';
import { inCallerOrganization } from './write-rules';

/**
 * A tax row of a sibling organization of the caller's tenant is not the caller's to read or write.
 *
 * The read by id the services inherit was narrowed to the tenant only, and every route that reads or writes one row
 * by id resolves it there first, so `PUT /tax-rates/:id`, `PUT /tax-regimes/:id`, `PUT /tax-categories/:id`, the
 * retirements and the withdraw/restore pair reached another organization's row by its id.
 *
 * The inherited read is stubbed to answer the row as the tenant-scoped read would; what is under test is what each
 * service does with it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

/** The inherited tenant-scoped read, answering a row of the given organization. */
function storedIn(organizationId: string | null) {
	return jest
		.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
		.mockImplementation(async (id) => ({ id, tenantId: TENANT, organizationId }) as never);
}

const emptyRepository = { findOne: async () => null, find: async () => [] };

const services = () => {
	const taxCategoryService = new TaxCategoryService(emptyRepository as never, {} as never);
	const taxRatePartService = new TaxRatePartService(emptyRepository as never, {} as never);
	const taxRegimeRateService = new TaxRegimeRateService(emptyRepository as never, {} as never);
	const taxRegimeService = new TaxRegimeService(
		emptyRepository as never,
		{} as never,
		taxRegimeRateService,
		emptyRepository as never
	);
	const taxRateService = new TaxRateService(
		emptyRepository as never,
		{} as never,
		taxCategoryService,
		taxRatePartService,
		taxRegimeService
	);

	return { taxCategoryService, taxRatePartService, taxRegimeRateService, taxRegimeService, taxRateService };
};

describe('tax — a row of another organization of the tenant', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the read by id', () => {
		it.each(Object.keys(services()))('%s answers it as a miss', async (name) => {
			storedIn(OTHER_ORG);
			const service = (services() as Record<string, TenantAwareCrudService<any>>)[name];

			await expect(service.findOneByIdString('row')).rejects.toBeInstanceOf(NotFoundException);
		});

		it.each(Object.keys(services()))('%s still reads the caller’s own row', async (name) => {
			storedIn(ORG);
			const service = (services() as Record<string, TenantAwareCrudService<any>>)[name];

			await expect(service.findOneByIdString('row')).resolves.toMatchObject({ id: 'row', organizationId: ORG });
		});

		it.each(Object.keys(services()))('%s still reads it for a tenant admin', async (name) => {
			// Owner decision (2026-10-22): a tenant admin reaches every organization of the tenant.
			jest.spyOn(RequestContext, 'hasRoles').mockImplementation((roles: RolesEnum[]) =>
				roles.includes(RolesEnum.ADMIN)
			);
			storedIn(OTHER_ORG);
			const service = (services() as Record<string, TenantAwareCrudService<any>>)[name];

			await expect(service.findOneByIdString('row')).resolves.toMatchObject({
				id: 'row',
				organizationId: OTHER_ORG
			});
		});
	});

	describe('the writes that resolve the row first', () => {
		it('does not update another organization’s rate, regime, category or part', async () => {
			storedIn(OTHER_ORG);
			const updated = jest
				.spyOn(TenantAwareCrudService.prototype, 'update')
				.mockResolvedValue({ affected: 1 } as never);
			const { taxRateService, taxRegimeService, taxCategoryService, taxRatePartService } = services();

			await expect(taxRateService.update('rate', { priority: 1 } as never)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(taxRegimeService.update('regime', { name: 'EU OSS' } as never)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(taxCategoryService.update('category', { name: 'Reduced' } as never)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(taxRatePartService.update('part', { name: 'State' } as never)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(updated).not.toHaveBeenCalled();
		});

		it('does not retire another organization’s rate', async () => {
			storedIn(OTHER_ORG);
			// The statement the retirement would issue once the row is found: the kernel's own soft delete
			const retired = jest
				.spyOn(Object.getPrototypeOf(TenantAwareCrudService.prototype), 'softDelete')
				.mockResolvedValue({ affected: 1 } as never);

			await expect(services().taxRateService.delete('rate')).rejects.toBeInstanceOf(NotFoundException);
			expect(retired).not.toHaveBeenCalled();
		});
	});

	describe('inCallerOrganization', () => {
		it('lets a row stored without an organization through, so an update can still give it the caller’s', () => {
			expect(inCallerOrganization({ organizationId: null }, ORG)).toEqual({ organizationId: null });
		});

		it('does not narrow a read with no organization in context', () => {
			expect(inCallerOrganization({ organizationId: OTHER_ORG }, null)).toEqual({ organizationId: OTHER_ORG });
		});
	});
});
