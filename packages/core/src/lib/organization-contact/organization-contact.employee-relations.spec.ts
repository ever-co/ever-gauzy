import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Brackets, EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationContactService } from './organization-contact.service';
import { resolveOrganizationContactEmployeeRelations } from './organization-contact-relations';

/**
 * GHSA-c3cj-m3xm-7j5h — `GET /api/organization-contact?data={"findInput":{"employeeId":...},"relations":[...]}`
 * routes to `OrganizationContactService.getOrganizationContactByEmployee`, which turned every client
 * relation string into a raw `leftJoinAndSelect`. The route carries only `TenantPermissionGuard` and no
 * `SensitiveRelationsInterceptor`, and the hand-built query never reaches the sink check in
 * `CrudService`, so `relations: ['members','organization','organization.payments']` selected every
 * payment of the organization for any member of the tenant — plain array form, no bypass trick.
 *
 * Each case below has a CONTROL that replays the pre-fix code on the same input.
 */

const TENANT_ID = '2b4f0a4e-0000-4000-8000-000000000001';
const CALLER_EMPLOYEE_ID = '2b4f0a4e-0000-4000-8000-0000000000e1';
const OTHER_EMPLOYEE_ID = '2b4f0a4e-0000-4000-8000-0000000000e2';

/** The join loop exactly as it stood before the fix, used as the control arm. */
function preFixJoinLoop(relations: string[], query: { alias: string; leftJoinAndSelect: Function }): void {
	relations.forEach((relation: string) => {
		if (relation.indexOf('.') !== -1) {
			const alias = relation.split('.').slice(-1)[0];
			query.leftJoinAndSelect(`${relation}`, alias);
		} else {
			const alias = relation;
			query.leftJoinAndSelect(`${query.alias}.${relation}`, alias);
		}
	});
}

interface QueryBuilderDouble {
	alias: string;
	joins: string[];
	predicates: { sql: string; params?: Record<string, unknown> }[];
	leftJoinAndSelect: jest.Mock;
	leftJoin: jest.Mock;
	where: jest.Mock;
	andWhere: jest.Mock;
	getManyAndCount: jest.Mock;
}

/** Records what the service asks the query builder to join and filter on, and returns no rows. */
function createQueryBuilderDouble(): QueryBuilderDouble {
	const qb: QueryBuilderDouble = {
		alias: 'organization_contact',
		joins: [],
		predicates: [],
		leftJoinAndSelect: jest.fn((property: string, alias: string) => {
			qb.joins.push(`SELECT ${property} AS ${alias}`);
			return qb;
		}),
		leftJoin: jest.fn((property: string, alias: string) => {
			qb.joins.push(`JOIN ${property} AS ${alias}`);
			return qb;
		}),
		where: jest.fn((argument: any) => {
			if (argument instanceof Brackets) {
				argument.whereFactory({
					where: (sql: string, params?: Record<string, unknown>) => {
						qb.predicates.push({ sql, params });
						return undefined as any;
					},
					orWhere: (sql: string, params?: Record<string, unknown>) => {
						qb.predicates.push({ sql, params });
						return undefined as any;
					}
				} as any);
			}
			return qb;
		}),
		andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
			qb.predicates.push({ sql, params });
			return qb;
		}),
		getManyAndCount: jest.fn().mockResolvedValue([[], 0])
	};

	return qb;
}

describe('OrganizationContactService.getOrganizationContactByEmployee', () => {
	const entity = (name: string, relations: Record<string, () => EntityMetadata> = {}): EntityMetadata =>
		({
			name,
			tableName: name.toLowerCase(),
			findRelationWithPropertyPath: (propertyPath: string) =>
				relations[propertyPath] ? { inverseEntityMetadata: relations[propertyPath]() } : undefined
		}) as unknown as EntityMetadata;

	const ORGANIZATION = (): EntityMetadata => entity('Organization', { payments: () => entity('Payment') });

	let granted: PermissionsEnum[];
	let queryBuilder: QueryBuilderDouble;
	let repository: { metadata: EntityMetadata; createQueryBuilder: jest.Mock };
	let service: OrganizationContactService;

	beforeEach(() => {
		granted = [];
		queryBuilder = createQueryBuilderDouble();
		repository = {
			metadata: entity('OrganizationContact', { organization: ORGANIZATION }),
			createQueryBuilder: jest.fn(() => queryBuilder)
		};

		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('2b4f0a4e-0000-4000-8000-0000000000u1' as any);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(CALLER_EMPLOYEE_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
		// Pin the ORM branch so a `DB_ORM` in the environment cannot route the case elsewhere.
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		service = new OrganizationContactService(repository as any, {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const call = (relations?: unknown, findInput: Record<string, unknown> = {}) =>
		service.getOrganizationContactByEmployee({
			relations,
			findInput: { employeeId: OTHER_EMPLOYEE_ID, contactType: 'CLIENT', ...findInput }
		});

	it('refuses a protected relation of the organization, before any query runs', async () => {
		await expect(call(['members', 'organization', 'organization.payments'])).rejects.toThrow(ForbiddenException);

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('CONTROL: the pre-fix loop joined and SELECTED those payments', () => {
		const control = createQueryBuilderDouble();

		preFixJoinLoop(['members', 'organization', 'organization.payments'], control);

		expect(control.joins).toEqual([
			'SELECT organization_contact.members AS members',
			'SELECT organization_contact.organization AS organization',
			// The dotted path resolves because the previous entry created the `organization` alias.
			'SELECT organization.payments AS payments'
		]);
	});

	it('allows a protected relation to a caller who holds the permission', async () => {
		granted = [PermissionsEnum.ORG_PAYMENT_VIEW];

		// It is still refused — but by the allowlist, with a 400, not by the permission table.
		await expect(call(['organization.payments'])).rejects.toThrow(BadRequestException);
	});

	it('refuses a relation outside the allowlist, financial ones included', async () => {
		for (const relation of ['invoices', 'payments', 'expenses', 'incomes', 'timeLogs', 'members.user']) {
			await expect(call([relation])).rejects.toThrow(BadRequestException);
		}

		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('joins the relations the clients really use', async () => {
		await expect(call(['members', 'tags', 'projects', 'contact', 'image'])).resolves.toEqual({
			items: [],
			total: 0
		});

		expect(queryBuilder.joins).toEqual([
			'SELECT organization_contact.members AS members',
			'SELECT organization_contact.tags AS tags',
			'SELECT organization_contact.projects AS projects',
			'SELECT organization_contact.contact AS contact',
			'SELECT organization_contact.image AS image'
		]);
	});

	it('joins members itself when the caller did not ask for them, so the member filter still resolves', async () => {
		await expect(call(['tags'])).resolves.toEqual({ items: [], total: 0 });

		expect(queryBuilder.joins).toEqual([
			'SELECT organization_contact.tags AS tags',
			'JOIN organization_contact.members AS members'
		]);
	});

	it('survives a request that sends no relations at all', async () => {
		await expect(call(undefined)).resolves.toEqual({ items: [], total: 0 });

		// CONTROL: the pre-fix code read `relations.length` straight away.
		expect(() => (undefined as unknown as string[]).length).toThrow(TypeError);
	});

	it('pins the employee to the caller unless they may act for other employees', async () => {
		await expect(call(['members'])).resolves.toEqual({ items: [], total: 0 });

		const memberPredicate = queryBuilder.predicates.find((predicate) => predicate.sql.includes('members.id'));

		expect(memberPredicate?.params).toEqual({ employeeId: CALLER_EMPLOYEE_ID });
	});

	it('honours the employee the request names for a CHANGE_SELECTED_EMPLOYEE holder', async () => {
		granted = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];

		await expect(call(['members'])).resolves.toEqual({ items: [], total: 0 });

		const memberPredicate = queryBuilder.predicates.find((predicate) => predicate.sql.includes('members.id'));

		expect(memberPredicate?.params).toEqual({ employeeId: OTHER_EMPLOYEE_ID });
	});

	it('never filters on a NULL employee, which would match contacts that have no members', async () => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);

		await expect(call(['members'])).resolves.toEqual({ items: [], total: 0 });

		expect(queryBuilder.predicates.filter((predicate) => predicate.sql.includes('members.id'))).toEqual([]);
	});

	it('still scopes the read to the caller tenant', async () => {
		await expect(call(['members'])).resolves.toEqual({ items: [], total: 0 });

		expect(queryBuilder.predicates).toContainEqual({
			sql: 'organization_contact.tenantId = :tenantId',
			params: { tenantId: TENANT_ID }
		});
	});
});

describe('resolveOrganizationContactEmployeeRelations', () => {
	it('accepts the allowlisted relations, as an array or as a comma separated string', () => {
		expect(resolveOrganizationContactEmployeeRelations(['members', 'tags'])).toEqual(['members', 'tags']);
		expect(resolveOrganizationContactEmployeeRelations('members,tags')).toEqual(['members', 'tags']);
		expect(resolveOrganizationContactEmployeeRelations(['members', 'members'])).toEqual(['members']);
	});

	it('treats an absent value as no relations', () => {
		expect(resolveOrganizationContactEmployeeRelations(undefined)).toEqual([]);
		expect(resolveOrganizationContactEmployeeRelations(null)).toEqual([]);
		expect(resolveOrganizationContactEmployeeRelations('')).toEqual([]);
	});

	it('refuses everything else, including the object form the interceptor bypass used', () => {
		expect(() => resolveOrganizationContactEmployeeRelations(['organization.payments'])).toThrow(
			BadRequestException
		);
		expect(() => resolveOrganizationContactEmployeeRelations({ organization: { payments: true } })).toThrow(
			BadRequestException
		);
		expect(() => resolveOrganizationContactEmployeeRelations([{ toString: () => 'members' }])).toThrow(
			BadRequestException
		);
	});
});
