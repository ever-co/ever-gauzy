/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntityMetadata } from 'typeorm';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { PermissionGuard } from '../shared/guards/permission.guard';
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactService } from './organization-contact.service';

/**
 * `GET /organization-contact/assignable`: the contacts an employee's Contacts tab offers to assign. Assigning
 * (`PUT /employee`) takes ORG_EMPLOYEES_EDIT, so choosing a contact takes the same, and gives no more than a choice
 * needs (id, name, picture, type); the full records stay behind ORG_CONTACT_VIEW.
 */
const TENANT_ID = '3c1d2e4f-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '3c1d2e4f-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '3c1d2e4f-0000-4000-8000-0000000000a1';
const ROLE_ID = '3c1d2e4f-0000-4000-8000-0000000000aa';

describe('OrganizationContactController.findAssignable permissions', () => {
	const contextFor = (handler: string): ExecutionContext =>
		({
			getType: () => 'http',
			getHandler: () => (OrganizationContactController.prototype as any)[handler],
			getClass: () => OrganizationContactController,
			switchToHttp: () => ({ getRequest: () => ({ headers: {}, method: 'GET' }) })
		}) as unknown as ExecutionContext;

	const allowed = (permissions: PermissionsEnum[]) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			tenantId: TENANT_ID,
			roleId: ROLE_ID,
			role: { id: ROLE_ID, name: RolesEnum.MANAGER, tenantId: TENANT_ID },
			permissions
		} as any);
		jest.spyOn(RequestContext, 'currentPermissions').mockReturnValue(permissions);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID as ID);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID as ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1' as ID);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(RolesEnum.MANAGER);
		const guard = new PermissionGuard({ get: jest.fn(async () => null), set: jest.fn() } as any, new Reflector(), {
			checkRolePermission: jest.fn(async () => false)
		} as any);
		return guard.canActivate(contextFor('findAssignable'));
	};

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it('lets an employee editor read it without ORG_CONTACT_VIEW', async () => {
		expect(await allowed([PermissionsEnum.ORG_EMPLOYEES_EDIT])).toBe(true);
	});

	it('refuses a holder of ORG_CONTACT_VIEW alone: assigning is an employee edit', async () => {
		expect(await allowed([PermissionsEnum.ORG_CONTACT_VIEW])).toBe(false);
	});

	it('refuses a caller with neither', async () => {
		expect(await allowed([])).toBe(false);
	});

	it('is declared before `/:id`, so "assignable" is not read as a contact id', () => {
		const handlers = Object.getOwnPropertyNames(OrganizationContactController.prototype);

		expect(handlers.indexOf('findAssignable')).toBeGreaterThan(-1);
		expect(handlers.indexOf('findAssignable')).toBeLessThan(handlers.indexOf('findById'));
	});
});

describe('OrganizationContactService.findAssignable', () => {
	const metadata = { name: 'OrganizationContact', tableName: 'organization_contact' } as unknown as EntityMetadata;

	/** Records what the service asks the query builder for, and returns `rows`. */
	const queryBuilderReturning = (rows: unknown[], total: number) => {
		const calls: Record<string, unknown[][]> = {};
		const record =
			(name: string) =>
			(...args: unknown[]) => {
				(calls[name] = calls[name] || []).push(args);
				return qb;
			};
		const qb: any = {
			alias: 'organization_contact',
			select: jest.fn(record('select')),
			where: jest.fn(record('where')),
			andWhere: jest.fn(record('andWhere')),
			orderBy: jest.fn(record('orderBy')),
			addOrderBy: jest.fn(record('addOrderBy')),
			skip: jest.fn(record('skip')),
			take: jest.fn(record('take')),
			getManyAndCount: jest.fn(async () => [rows, total])
		};
		return { qb, calls };
	};

	/** The membership lookup of `assertCurrentUserBelongsToOrganization`: the caller is a member. */
	const manager = { count: jest.fn(async () => 1) };

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID as ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1' as ID);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_ID as ID);
		manager.count.mockClear();
	});
	afterEach(() => jest.restoreAllMocks());

	describe('TypeORM', () => {
		beforeEach(() => jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM));

		const serviceWith = (qb: unknown) =>
			new OrganizationContactService({ metadata, manager, createQueryBuilder: jest.fn(() => qb) } as any, {} as any);

		it('selects the id, name, picture and type only, of the caller’s tenant and the organization', async () => {
			const { qb, calls } = queryBuilderReturning([{ id: 'c-1', name: 'Acme' }], 1);

			const page = await serviceWith(qb).findAssignable({
				organizationId: ORGANIZATION_ID,
				tenantId: OTHER_TENANT_ID // a client-sent tenant does not override the caller's
			});

			expect(calls.select).toEqual([
				[
					[
						'organization_contact.id',
						'organization_contact.name',
						'organization_contact.imageUrl',
						'organization_contact.contactType'
					]
				]
			]);
			expect(calls.where[0][1]).toEqual({ tenantId: TENANT_ID });
			expect(calls.andWhere.map(([, params]) => params)).toEqual([{ organizationId: ORGANIZATION_ID }]);
			expect(page).toEqual({ items: [{ id: 'c-1', name: 'Acme' }], total: 1 });
		});

		it('matches the name as a substring, orders by name then id, and reads the asked page', async () => {
			const { qb, calls } = queryBuilderReturning([], 0);

			await serviceWith(qb).findAssignable({ organizationId: ORGANIZATION_ID, name: ' acme ', take: 20, skip: 3 });

			const namePredicate = calls.andWhere.find(([sql]) => String(sql).includes('name'));
			expect(namePredicate?.[1]).toEqual({ name: '%acme%' });
			expect(calls.orderBy).toEqual([['organization_contact.name', 'ASC']]);
			expect(calls.addOrderBy).toEqual([['organization_contact.id', 'ASC']]);
			expect(calls.skip).toEqual([[40]]); // page 3 of 20
			expect(calls.take).toEqual([[20]]);
		});

		it('refuses a request without an organization before reading', async () => {
			const { qb } = queryBuilderReturning([], 0);

			await expect(serviceWith(qb).findAssignable({ organizationId: undefined as unknown as ID })).rejects.toThrow(
				BadRequestException
			);
			expect(qb.select).not.toHaveBeenCalled();
		});

		it("refuses an organization other than the caller's before reading", async () => {
			const { qb } = queryBuilderReturning([], 0);
			const otherOrganizationId = '3c1d2e4f-0000-4000-8000-0000000000b2';

			await expect(serviceWith(qb).findAssignable({ organizationId: otherOrganizationId })).rejects.toThrow(
				ForbiddenException
			);
			expect(qb.select).not.toHaveBeenCalled();
		});

		it('CONTROL: without a name, filters by tenant and organization only, from the first page of 30', async () => {
			const { qb, calls } = queryBuilderReturning([], 0);

			await serviceWith(qb).findAssignable({ organizationId: ORGANIZATION_ID, name: '  ' });

			expect(calls.andWhere).toHaveLength(1);
			expect(calls.skip).toEqual([[0]]);
			expect(calls.take).toEqual([[30]]);
		});
	});

	describe('MikroORM', () => {
		beforeEach(() => jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM));

		it('asks for the same fields, filter, order and page', async () => {
			const findAndCount = jest.fn(async () => [[{ id: 'c-1', name: 'Acme' }], 1]);
			const service = new OrganizationContactService({ metadata, manager } as any, { findAndCount } as any);
			jest.spyOn(service as any, 'serialize').mockImplementation((entity) => entity);

			const page = await service.findAssignable({
				organizationId: ORGANIZATION_ID,
				tenantId: OTHER_TENANT_ID,
				name: 'acme',
				take: 20,
				skip: 2
			});

			const [where, options] = findAndCount.mock.calls[0] as unknown as [any, any];
			expect(where.tenantId).toBe(TENANT_ID);
			expect(where.organizationId).toBe(ORGANIZATION_ID);
			expect(Object.values(where.name)).toEqual(['%acme%']); // $ilike on PostgreSQL, $like elsewhere
			expect(options).toEqual({
				fields: ['id', 'name', 'imageUrl', 'contactType'],
				orderBy: { name: 'ASC', id: 'ASC' },
				offset: 20,
				limit: 20
			});
			expect(page).toEqual({ items: [{ id: 'c-1', name: 'Acme' }], total: 1 });
		});
	});
});
