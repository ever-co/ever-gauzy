/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `favorite.resolver.spec.ts` / `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { In } from 'typeorm';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { FavoriteService } from './favorite.service';

/**
 * A favorite is its employee's, or the organization's when an admin files it without an employee. The CRUD base
 * limits a caller without CHANGE_SELECTED_EMPLOYEE to their own employee, but a caller with no employee record at all
 * (a viewer, a candidate), who may create no favorite, kept the tenant-wide scope: `GET /favorite/employee` answered
 * any employee's favorites, or every employee's.
 */
describe('FavoriteService — a caller with no employee record reads no one’s favorites', () => {
	const VICTIM = 'victim-employee';

	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: FavoriteService;

	beforeEach(() => {
		findAll = jest.spyOn(CrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 } as never);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
		service = new FavoriteService(
			{} as never,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'favorite', hasColumnWithPropertyPath: () => true } } as any,
			{} as never,
			{} as never
		);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	const listedFor = async (employeeId?: string) => {
		await service.findFavoritesByEmployee({ where: { ...(employeeId && { employeeId }) } } as never);
		return findAll.mock.calls[0][0].where;
	};

	it('a viewer lists no favorite, named employee or not', async () => {
		({ restore } = asTenantUser(createTenantFixture()));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: In([]) });
		findAll.mockClear();
		expect(await listedFor()).toMatchObject({ employeeId: In([]) });
	});

	it('CONTROL: an employee lists their own favorites, whatever the query names', async () => {
		({ restore } = asTenantUser(createTenantFixture({ user: { employeeId: 'own-employee' } as IUser })));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: 'own-employee' });
	});

	it('CONTROL: an admin with no employee record keeps the tenant-wide scope organization favorites need', async () => {
		({ restore } = asTenantUser(createTenantFixture()));
		(RequestContext.hasRoles as jest.Mock).mockImplementation((roles: RolesEnum[]) => roles.includes(RolesEnum.ADMIN));

		expect(await listedFor(VICTIM)).toEqual(expect.objectContaining({ employeeId: VICTIM }));
	});

	it('CONTROL: a caller who may act for other employees lists the employee they name', async () => {
		({ restore } = asTenantUser(createTenantFixture(), {
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		}));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: VICTIM });
	});
});
