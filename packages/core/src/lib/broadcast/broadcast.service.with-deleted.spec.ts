import '../core/entities/internal';

import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { BroadcastVisibilityModeEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { BroadcastService } from './broadcast.service';

/**
 * SD-7 — `broadcasts(withDeleted: true)`, and the REST list route through the same `findAll`, never
 * answered a retired broadcast on either ORM: `findAll` rebuilds its options by *naming* the members it
 * forwards (`where`, `relations`, `order`, `take`, `skip`) and `withDeleted` was not one of them, so the
 * flag the resolver forwards was dropped before the CRUD base ever saw it.
 *
 * The cases run the service's real `findAll` through the real `TenantAwareCrudService` and `CrudService`
 * reads under each ORM, over a scripted repository, and assert what reaches the store: TypeORM's
 * `withDeleted`, and MikroORM's soft-delete filter disabled by name — never the tenant or organization
 * of the `where`, which must reach the store unchanged whichever way the flag is stated.
 */

const TENANT = '61000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '61000000-0000-4000-8000-0000000000a1';

/** A retired broadcast the whole organization may read, so the visibility pass keeps it. */
const RETIRED = {
	id: '61000000-0000-4000-8000-000000000001',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	visibilityMode: BroadcastVisibilityModeEnum.ORGANIZATION,
	deletedAt: new Date('2026-01-01T00:00:00.000Z')
};

/** The service over scripted repositories, with the collaborators `findAll` never reaches left empty. */
function surfaces() {
	const typeOrmRepository = {
		metadata: { tableName: 'broadcast', hasColumnWithPropertyPath: (path: string) => path === 'tenantId' },
		findAndCount: jest.fn().mockResolvedValue([[RETIRED], 1])
	};
	// MikroORM's branch serializes what it reads through `wrap(...)`, which a plain object is not, so
	// its store answers nothing: the assertion is what the read asked for.
	const mikroOrmRepository = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
	const service = new BroadcastService(
		{} as any,
		typeOrmRepository as any,
		mikroOrmRepository as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any
	);

	return { service, typeOrmRepository, mikroOrmRepository };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', tenantId: TENANT } as any);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission: PermissionsEnum) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
});

afterEach(() => jest.restoreAllMocks());

describe('BroadcastService.findAll forwards withDeleted (TypeORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	it('asks the store for retired broadcasts when the caller does, inside the caller scope', async () => {
		const { service, typeOrmRepository } = surfaces();

		const { items } = await service.findAll({ withDeleted: true } as any);

		// The failure scenario: the options reached the store without `withDeleted`, so the repository
		// kept its `deletedAt IS NULL` and a retired broadcast was never answered.
		const [options] = typeOrmRepository.findAndCount.mock.calls[0];
		expect(options.withDeleted).toBe(true);
		expect(options.where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
		expect(items.map((item) => item.id)).toEqual([RETIRED.id]);
	});

	it('does not ask for retired broadcasts without the flag, or when the query string says "false"', async () => {
		for (const stated of [{}, { withDeleted: 'false' }, { withDeleted: false }]) {
			const { service, typeOrmRepository } = surfaces();

			await service.findAll(stated as any);

			const [options] = typeOrmRepository.findAndCount.mock.calls[0];
			expect(options.withDeleted).toBeUndefined();
			expect(options.where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
		}
	});

	it('reads the REST query string "true" as the flag', async () => {
		const { service, typeOrmRepository } = surfaces();

		await service.findAll({ withDeleted: 'true' } as any);

		expect(typeOrmRepository.findAndCount.mock.calls[0][0].withDeleted).toBe(true);
	});
});

describe('BroadcastService.findAll forwards withDeleted (MikroORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	it('disables the soft-delete filter, and only that filter, when the caller asks for retired broadcasts', async () => {
		const { service, mikroOrmRepository } = surfaces();

		await service.findAll({ withDeleted: true } as any);

		const [where, options] = mikroOrmRepository.findAndCount.mock.calls[0];
		expect(options.filters).toEqual({ [SOFT_DELETABLE_FILTER]: false });
		expect(where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
	});

	it('leaves the soft-delete filter on without the flag, or when the query string says "false"', async () => {
		for (const stated of [{}, { withDeleted: 'false' }, { withDeleted: false }]) {
			const { service, mikroOrmRepository } = surfaces();

			await service.findAll(stated as any);

			const [where, options] = mikroOrmRepository.findAndCount.mock.calls[0];
			expect(options.filters).toBeUndefined();
			expect(where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
		}
	});
});
