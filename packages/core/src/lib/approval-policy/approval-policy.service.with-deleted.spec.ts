import '../core/entities/internal';

import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { ApprovalPolicyService } from './approval-policy.service';

/**
 * SD-9 — `GET /approval-policy?withDeleted=false` answered soft-deleted approval policies. The route
 * mounts `@UseValidationPipe()` without `transform`, so its query string reaches the service as text,
 * and `findAllApprovalPolicies` tested the flag by truthiness: the non-empty string 'false' read as a
 * request for the retired rows. The GraphQL field hands a real boolean, so the two surfaces answered
 * the same stated request differently.
 *
 * The cases run the service's real reader through the real `TenantAwareCrudService` and `CrudService`
 * reads under each ORM, over a scripted repository, and assert what reaches the store — never the
 * tenant scope of the `where`, which must reach the store whichever way the flag is stated.
 */

const TENANT = '62000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '62000000-0000-4000-8000-0000000000a1';

/** The service over scripted repositories. */
function surfaces() {
	const typeOrmRepository = {
		metadata: { tableName: 'approval_policy', hasColumnWithPropertyPath: (path: string) => path === 'tenantId' },
		findAndCount: jest.fn().mockResolvedValue([[], 0])
	};
	const mikroOrmRepository = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };

	return {
		service: new ApprovalPolicyService(typeOrmRepository as any, mikroOrmRepository as any),
		typeOrmRepository,
		mikroOrmRepository
	};
}

/** The options the REST route hands over for `?withDeleted=<stated>&where[organizationId]=...`. */
const restQuery = (withDeleted?: unknown) =>
	({ where: { organizationId: ORGANIZATION }, ...(withDeleted === undefined ? {} : { withDeleted }) }) as any;

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', tenantId: TENANT } as any);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission: PermissionsEnum) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
});

afterEach(() => jest.restoreAllMocks());

describe('ApprovalPolicyService.findAllApprovalPolicies reads withDeleted as a boolean (TypeORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	it('does not ask for retired policies when the query string says "false"', async () => {
		const { service, typeOrmRepository } = surfaces();

		await service.findAllApprovalPolicies(restQuery('false'));

		// The failure scenario: the string 'false' is truthy, so this reached the store as `true`.
		const [options] = typeOrmRepository.findAndCount.mock.calls[0];
		expect(options.withDeleted).toBeUndefined();
		expect(options.where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
	});

	it('asks for retired policies when the flag is stated as true, over either surface', async () => {
		// `'true'` is the REST query string, `true` is the GraphQL argument.
		for (const stated of ['true', true]) {
			const { service, typeOrmRepository } = surfaces();

			await service.findAllApprovalPolicies(restQuery(stated));

			const [options] = typeOrmRepository.findAndCount.mock.calls[0];
			expect(options.withDeleted).toBe(true);
			expect(options.where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
		}
	});

	it('does not ask for retired policies when the flag is absent or false', async () => {
		for (const stated of [undefined, false]) {
			const { service, typeOrmRepository } = surfaces();

			await service.findAllApprovalPolicies(restQuery(stated));

			expect(typeOrmRepository.findAndCount.mock.calls[0][0].withDeleted).toBeUndefined();
		}
	});
});

describe('ApprovalPolicyService.findAllApprovalPolicies reads withDeleted as a boolean (MikroORM)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	it('leaves the soft-delete filter on when the query string says "false"', async () => {
		const { service, mikroOrmRepository } = surfaces();

		await service.findAllApprovalPolicies(restQuery('false'));

		const [where, options] = mikroOrmRepository.findAndCount.mock.calls[0];
		expect(options.filters).toBeUndefined();
		expect(where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
	});

	it('disables the soft-delete filter, and only that filter, when the flag is stated as true', async () => {
		for (const stated of ['true', true]) {
			const { service, mikroOrmRepository } = surfaces();

			await service.findAllApprovalPolicies(restQuery(stated));

			const [where, options] = mikroOrmRepository.findAndCount.mock.calls[0];
			expect(options.filters).toEqual({ [SOFT_DELETABLE_FILTER]: false });
			expect(where).toEqual(expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION }));
		}
	});
});
