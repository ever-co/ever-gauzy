import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { OfficialHolidayService } from './official-holiday.service';

const TENANT_ID = 'b6b0b0a6-2d6d-4f4e-9d5a-7a3f1f2c9e10';
const ORGANIZATION_ID = 'f1b2c3d4-e5f6-4708-8a9b-0c1d2e3f4a5b';

/**
 * The listing reads through the raw repository, where an undefined `organizationId` is dropped from
 * the where object instead of matching nothing. Without an organization the query would span every
 * organization of the caller's tenant, so it has to fail closed.
 */
describe('OfficialHolidayService.findAllByFilter organization scope', () => {
	let service: OfficialHolidayService;
	let repository: { findAndCount: jest.Mock };

	beforeEach(() => {
		repository = { findAndCount: jest.fn(async () => [[], 0]) };
		service = new OfficialHolidayService(repository as any, {} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('refuses to list without an organization instead of spanning the tenant', async () => {
		await expect(service.findAllByFilter({} as any)).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.findAllByFilter({ countryCode: 'ES' } as any)).rejects.toBeInstanceOf(BadRequestException);
		// `sentTo` is what suppresses the conditional organizationId validation on the query DTO, so a request
		// carrying it must still be refused here.
		await expect(service.findAllByFilter({ sentTo: 'someone@example.com' } as any)).rejects.toBeInstanceOf(
			BadRequestException
		);

		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('scopes the query to the tenant and the organization when one is supplied', async () => {
		await service.findAllByFilter({ organizationId: ORGANIZATION_ID } as any);

		expect(repository.findAndCount).toHaveBeenCalledTimes(1);
		expect(repository.findAndCount.mock.calls[0][0].where).toEqual({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID
		});
	});

	it('keeps the country and year filters, and both arms of the recurring-holiday query scoped', async () => {
		await service.findAllByFilter({ organizationId: ORGANIZATION_ID, countryCode: 'es', year: 2026 } as any);

		const { where } = repository.findAndCount.mock.calls[0][0];
		expect(Array.isArray(where)).toBe(true);
		for (const arm of where) {
			expect(arm).toEqual(
				expect.objectContaining({
					tenantId: TENANT_ID,
					organizationId: ORGANIZATION_ID,
					countryCode: 'ES'
				})
			);
		}
	});
});
