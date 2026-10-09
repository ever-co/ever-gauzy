import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { OfficialHolidayService } from './official-holiday.service';

const TENANT_ID = 'b6b0b0a6-2d6d-4f4e-9d5a-7a3f1f2c9e10';
const ORGANIZATION_ID = 'f1b2c3d4-e5f6-4708-8a9b-0c1d2e3f4a5b';
const SIBLING_ORGANIZATION_ID = '0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d';
const USER_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
const HOLIDAY_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';

/**
 * The listing reads through the raw repository, where an undefined `organizationId` is dropped from
 * the where object instead of matching nothing. Without an organization the query would span every
 * organization of the caller's tenant, so it has to fail closed.
 */
describe('OfficialHolidayService.findAllByFilter organization scope', () => {
	let service: OfficialHolidayService;
	let repository: { findAndCount: jest.Mock; manager: { count: jest.Mock } };

	beforeEach(() => {
		// The caller is a member of ORGANIZATION_ID only.
		repository = {
			findAndCount: jest.fn(async () => [[], 0]),
			manager: {
				count: jest.fn(async (_entity, { where }) => (where.organizationId === ORGANIZATION_ID ? 1 : 0))
			}
		};
		service = new OfficialHolidayService(repository as any, {} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
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

	it('refuses an organization the caller is not a member of, even when `sentTo` skipped the DTO check', async () => {
		await expect(
			service.findAllByFilter({ organizationId: SIBLING_ORGANIZATION_ID } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.findAllByFilter({ organizationId: SIBLING_ORGANIZATION_ID, sentTo: 'someone@example.com' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(repository.manager.count.mock.calls[0][1].where).toEqual({
			tenantId: TENANT_ID,
			userId: USER_ID,
			organizationId: SIBLING_ORGANIZATION_ID
		});
		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('refuses when there is no authenticated user to check membership for', async () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		await expect(service.findAllByFilter({ organizationId: ORGANIZATION_ID } as any)).rejects.toBeInstanceOf(
			ForbiddenException
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

/**
 * The by-id routes name no organization, so nothing validates one for them and the inherited CRUD methods
 * stop at the tenant. A tenant holds many organizations, so the organization has to be read off the STORED
 * row and the caller checked against it — otherwise a holder of the Time Off policy permissions could read,
 * change or delete a sibling organization's holiday by passing its id.
 */
describe('OfficialHolidayService by-id organization scope', () => {
	let service: OfficialHolidayService;
	let repository: {
		findOne: jest.Mock;
		findOneBy: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
		metadata: { hasColumnWithPropertyPath: jest.Mock };
		manager: { count: jest.Mock };
	};

	/** Puts the stored holiday in `organizationId`, whatever the request said. */
	const storedIn = (organizationId?: string) => {
		repository.findOne.mockImplementation(async () => ({
			id: HOLIDAY_ID,
			tenantId: TENANT_ID,
			organizationId,
			name: 'Christmas Day',
			countryCode: 'ES',
			date: '2026-12-25'
		}));
	};

	beforeEach(() => {
		// The caller is a member of ORGANIZATION_ID only.
		repository = {
			findOne: jest.fn(),
			// The re-read `TenantAwareCrudService.update()` does for an object criteria; it 404s on a miss,
			// which is what rejects a holiday re-parented between the check and the write.
			findOneBy: jest.fn(async () => ({ id: HOLIDAY_ID })),
			update: jest.fn(async () => ({ affected: 1, raw: [] })),
			delete: jest.fn(async () => ({ affected: 1, raw: [] })),
			metadata: {
				// `employeeId` deliberately absent: an official holiday is organization-level configuration.
				hasColumnWithPropertyPath: jest.fn((column: string) => column === 'tenantId')
			},
			manager: {
				count: jest.fn(async (_entity, { where }) => (where.organizationId === ORGANIZATION_ID ? 1 : 0))
			}
		};
		service = new OfficialHolidayService(repository as any, {} as any);
		storedIn(ORGANIZATION_ID);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER_ID, tenantId: TENANT_ID } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('reads a holiday of an organization the caller belongs to', async () => {
		const holiday = await service.findOneByIdString(HOLIDAY_ID);

		expect(holiday.id).toEqual(HOLIDAY_ID);
		// Still tenant scoped, and the membership is checked against the organization of the stored row.
		expect(repository.findOne.mock.calls[0][0].where).toEqual(
			expect.objectContaining({ id: HOLIDAY_ID, tenantId: TENANT_ID })
		);
		expect(repository.manager.count).toHaveBeenCalledTimes(1);
		expect(repository.manager.count.mock.calls[0][1].where).toEqual({
			tenantId: TENANT_ID,
			userId: USER_ID,
			organizationId: ORGANIZATION_ID
		});
	});

	it('refuses to read a holiday of a sibling organization of the tenant', async () => {
		storedIn(SIBLING_ORGANIZATION_ID);

		await expect(service.findOneByIdString(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		expect(repository.manager.count.mock.calls[0][1].where).toEqual({
			tenantId: TENANT_ID,
			userId: USER_ID,
			organizationId: SIBLING_ORGANIZATION_ID
		});
	});

	it('refuses to update a holiday of a sibling organization, before it writes', async () => {
		storedIn(SIBLING_ORGANIZATION_ID);

		await expect(service.update(HOLIDAY_ID, { name: 'Renamed' } as any)).rejects.toBeInstanceOf(ForbiddenException);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it("refuses to re-parent a sibling organization's holiday by naming its own in the body", async () => {
		storedIn(SIBLING_ORGANIZATION_ID);

		await expect(service.update(HOLIDAY_ID, { organizationId: ORGANIZATION_ID } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		// The organization is taken from the stored row, never from the payload — naming one the caller does
		// belong to must not buy access to a row that lives somewhere else.
		expect(repository.manager.count.mock.calls[0][1].where.organizationId).toEqual(SIBLING_ORGANIZATION_ID);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('updates a holiday of its own organization, and pins that organization onto the write', async () => {
		await expect(service.update(HOLIDAY_ID, { name: 'Renamed' } as any)).resolves.toBeDefined();

		// The membership check is an unlocked read and the base class otherwise writes by raw id, so the
		// organization it was decided on has to reach the UPDATE's own WHERE.
		expect(repository.update.mock.calls[0][0]).toEqual({ id: HOLIDAY_ID, organizationId: ORGANIZATION_ID });
		expect(repository.manager.count).toHaveBeenCalledTimes(1);
	});

	it('refuses an update whose holiday was re-parented between the check and the write', async () => {
		// The re-read that carries the organization finds nothing, because the row has moved on.
		repository.findOneBy.mockResolvedValue(null);

		await expect(service.update(HOLIDAY_ID, { name: 'Renamed' } as any)).rejects.toBeInstanceOf(NotFoundException);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('refuses an update whose holiday moved after the re-read, so the write matched nothing', async () => {
		repository.update.mockResolvedValue({ affected: 0, raw: [] });
		// Present for the re-read that precedes the write, gone by the time we ask again.
		repository.findOneBy.mockResolvedValueOnce({ id: HOLIDAY_ID }).mockResolvedValueOnce(null);

		await expect(service.update(HOLIDAY_ID, { name: 'Renamed' } as any)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('accepts an update that changed nothing, which MySQL also reports as zero rows', async () => {
		// MySQL counts rows CHANGED, not matched, so rewriting a field with its current value reports zero.
		// The row is still ours, so that must not become a 404.
		repository.update.mockResolvedValue({ affected: 0, raw: [] });

		await expect(service.update(HOLIDAY_ID, { name: 'Christmas Day' } as any)).resolves.toEqual({
			affected: 0,
			raw: []
		});
		expect(repository.findOneBy).toHaveBeenCalledTimes(2);
	});

	it('refuses a delete whose holiday was re-parented between the check and the write', async () => {
		// The organization predicate is on the DELETE, so the row that moved is simply not matched.
		repository.delete.mockResolvedValue({ affected: 0, raw: [] });

		await expect(service.delete(HOLIDAY_ID)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses to delete a holiday of a sibling organization, before it deletes', async () => {
		storedIn(SIBLING_ORGANIZATION_ID);

		await expect(service.delete(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		expect(repository.delete).not.toHaveBeenCalled();
	});

	it('deletes a holiday of an organization the caller belongs to', async () => {
		await expect(service.delete(HOLIDAY_ID)).resolves.toEqual({ affected: 1, raw: [] });
		expect(repository.delete).toHaveBeenCalledTimes(1);
		// Tenant scoped as before, plus the organization the caller was authorized against.
		expect(repository.delete.mock.calls[0][0]).toEqual(
			expect.objectContaining({ id: HOLIDAY_ID, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
		);
	});

	it('falls back to the relation when the organization-id mirror was not hydrated', async () => {
		// MikroORM maps the relation-id column to `persist: false` and does not always fill it in, so reading
		// the mirror alone would refuse a member of the holiday's own organization.
		repository.findOne.mockImplementation(async () => ({
			id: HOLIDAY_ID,
			tenantId: TENANT_ID,
			organization: { id: ORGANIZATION_ID }
		}));

		await expect(service.findOneByIdString(HOLIDAY_ID)).resolves.toBeDefined();
		expect(repository.manager.count.mock.calls[0][1].where.organizationId).toEqual(ORGANIZATION_ID);
	});

	it('refuses a holiday that belongs to no organization instead of leaving it tenant-manageable', async () => {
		storedIn(undefined);

		await expect(service.findOneByIdString(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.delete(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		// Nothing to check membership against, so the lookup is never even attempted.
		expect(repository.manager.count).not.toHaveBeenCalled();
		expect(repository.delete).not.toHaveBeenCalled();
	});

	it('refuses when there is no authenticated user to check membership for', async () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		await expect(service.findOneByIdString(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.delete(HOLIDAY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		expect(repository.delete).not.toHaveBeenCalled();
	});
});
