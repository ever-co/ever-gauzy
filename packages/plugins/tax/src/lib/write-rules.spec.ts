import { BadRequestException } from '@nestjs/common';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxCategoryService } from './tax-category/tax-category.service';
import { TaxRateService } from './tax-rate/tax-rate.service';
import { TaxRegimeService } from './tax-regime/tax-regime.service';
import { assertCountryCode, assertOrganizationUnchanged, assertPriority, retirementResult } from './write-rules';

/**
 * R2-G34 (tax): the rules a REST DTO states and a GraphQL input cannot, the organization a row stays in,
 * and what a retirement answers.
 *
 * - `@Min(0)` on a priority and `@Length(2, 2)` on a country code refused a REST body, while the GraphQL
 *   inputs (`Int`, `String`) let the same values through. The services state both now.
 * - The REST update DTOs inherit `organizationId`, and the payload reached the write as it came, so a
 *   `PUT` could move a rate, a regime or a category into another organization of the tenant.
 * - A retirement answered `{ affected: 1 }` whatever the statement retired.
 *
 * Persistence is stubbed at the inherited CRUD service: what is under test is what these services refuse
 * before they reach it, and what they answer after it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const CATEGORY = '00000000-0000-4000-8000-000000000050';

function taxRateService() {
	const service = new TaxRateService(
		{} as never,
		{} as never,
		{
			findOneByIdString: async (id: string) => (id === CATEGORY ? { id: CATEGORY, code: 'STANDARD' } : null)
		} as never,
		{ listForRate: async () => [] } as never,
		{} as never
	);

	jest.spyOn(service, 'find').mockResolvedValue([] as never);

	return service;
}

describe('tax — write rules both protocols share (R2-G34)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the helpers', () => {
		it('accepts a whole priority of zero or more, and refuses anything else', () => {
			expect(() => assertPriority(undefined, 'a rate')).not.toThrow();
			expect(() => assertPriority(0, 'a rate')).not.toThrow();
			expect(() => assertPriority(10, 'a rate')).not.toThrow();
			expect(() => assertPriority(-1, 'a rate')).toThrow(BadRequestException);
			expect(() => assertPriority(1.5, 'a rate')).toThrow(BadRequestException);
		});

		it('accepts a two-letter country, and refuses a three-letter one', () => {
			expect(() => assertCountryCode(undefined, 'a rate')).not.toThrow();
			expect(() => assertCountryCode('CA', 'a rate')).not.toThrow();
			expect(() => assertCountryCode('CAN', 'a rate')).toThrow(BadRequestException);
			// `@Length(2, 2)` refuses these over REST; stored, the zone match would read them as "any country".
			expect(() => assertCountryCode('', 'a rate')).toThrow(BadRequestException);
			expect(() => assertCountryCode(' CA', 'a rate')).toThrow(BadRequestException);
			expect(() => assertCountryCode('C ', 'a rate')).toThrow(BadRequestException);
		});

		it('refuses an update that moves a row, and accepts one that restates its organization', () => {
			expect(() => assertOrganizationUnchanged({ organizationId: ORG }, ORG, ORG, 'A rate')).not.toThrow();
			expect(() => assertOrganizationUnchanged({}, ORG, ORG, 'A rate')).not.toThrow();
			expect(() => assertOrganizationUnchanged({ organizationId: OTHER_ORG }, ORG, ORG, 'A rate')).toThrow(
				/TAX_ORGANIZATION_IMMUTABLE/
			);
		});

		it('answers the number of rows a retirement retired', () => {
			expect(retirementResult({ affected: 3 })).toEqual({ affected: 3, raw: [] });
			// An ORM that answers with the row retired that one row.
			expect(retirementResult({ id: 'rate' })).toEqual({ affected: 1, raw: [] });
		});
	});

	describe('TaxRateService', () => {
		it('refuses a negative priority and a three-letter country on create, as the REST DTO does', async () => {
			const created = jest
				.spyOn(TenantAwareCrudService.prototype, 'create')
				.mockImplementation(async (entity) => entity as never);
			const service = taxRateService();
			const rate = { taxCategoryId: CATEGORY, code: 'GST', name: 'GST', rate: 0.05 };

			await expect(service.create({ ...rate, priority: -1 } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.create({ ...rate, countryCode: 'CAN' } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(created).not.toHaveBeenCalled();
		});

		it('refuses an update that moves a rate into another organization', async () => {
			const updated = jest
				.spyOn(TenantAwareCrudService.prototype, 'update')
				.mockImplementation(async () => ({ affected: 1 }) as never);
			const service = taxRateService();
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'gst', organizationId: ORG } as never);

			await expect(service.update('gst', { organizationId: OTHER_ORG } as never)).rejects.toThrow(
				/TAX_ORGANIZATION_IMMUTABLE/
			);
			expect(updated).not.toHaveBeenCalled();
		});

		it('answers the number of rows its retirement retired', async () => {
			jest.spyOn(TenantAwareCrudService.prototype, 'softDelete').mockResolvedValue({ affected: 2 } as never);

			await expect(taxRateService().delete({ code: 'GST' })).resolves.toEqual({ affected: 2, raw: [] });
		});
	});

	describe('TaxRegimeService', () => {
		it('refuses a negative priority and a three-letter country on create', async () => {
			const created = jest
				.spyOn(TenantAwareCrudService.prototype, 'create')
				.mockImplementation(async (entity) => entity as never);
			const service = new TaxRegimeService({} as never, {} as never, {} as never, {} as never);

			await expect(service.create({ name: 'EU OSS', priority: -5 } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.create({ name: 'EU OSS', countryCode: 'DEU' } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(created).not.toHaveBeenCalled();
		});

		it('refuses an update that moves a regime through the organization relation alone', async () => {
			const updated = jest
				.spyOn(TenantAwareCrudService.prototype, 'update')
				.mockImplementation(async () => ({ affected: 1 }) as never);
			const service = new TaxRegimeService({} as never, {} as never, {} as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'oss', organizationId: ORG } as never);

			await expect(service.update('oss', { organization: { id: OTHER_ORG } } as never)).rejects.toThrow(
				/TAX_ORGANIZATION_IMMUTABLE/
			);
			expect(updated).not.toHaveBeenCalled();
		});

		it('refuses an update that moves a regime into another organization', async () => {
			const updated = jest
				.spyOn(TenantAwareCrudService.prototype, 'update')
				.mockImplementation(async () => ({ affected: 1 }) as never);
			const service = new TaxRegimeService({} as never, {} as never, {} as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'oss', organizationId: ORG } as never);

			await expect(service.update('oss', { organizationId: OTHER_ORG } as never)).rejects.toThrow(
				/TAX_ORGANIZATION_IMMUTABLE/
			);
			expect(updated).not.toHaveBeenCalled();
		});
	});

	describe('TaxCategoryService', () => {
		it('refuses an update that moves a category into another organization', async () => {
			const updated = jest
				.spyOn(TenantAwareCrudService.prototype, 'update')
				.mockImplementation(async () => ({ affected: 1 }) as never);
			const service = new TaxCategoryService({} as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'standard',
				organizationId: ORG,
				code: 'STANDARD'
			} as never);

			await expect(service.update('standard', { organizationId: OTHER_ORG } as never)).rejects.toThrow(
				/TAX_ORGANIZATION_IMMUTABLE/
			);
			expect(updated).not.toHaveBeenCalled();
		});
	});
});
