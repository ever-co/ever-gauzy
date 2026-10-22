import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { IssueTypeService } from './issue-type.service';

describe('IssueTypeService', () => {
	it('returns system defaults without logging an error when a TypeORM scope has no issue types', async () => {
		const queryBuilder = {
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(null),
			getManyAndCount: jest.fn()
		};
		const typeOrmRepository = {
			metadata: { tableName: 'issue_type' },
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
		};
		const service = new IssueTypeService(typeOrmRepository as never, {} as never, {} as never);
		const defaults = { items: [], total: 0 };

		jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service, 'getDefaultEntities').mockResolvedValue(defaults);
		const errorLogger = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);

		await expect(
			service.fetchAll({
				tenantId: 'tenant-id',
				organizationId: 'organization-id',
				organizationTeamId: 'team-id'
			})
		).resolves.toStrictEqual(defaults);

		expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);
		expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
		expect(service.getDefaultEntities).toHaveBeenCalledTimes(1);
		expect(errorLogger).not.toHaveBeenCalled();
	});
});

/**
 * #10728 — the MikroORM branch of `GET /issue-types` built its filter from the query params only, so a request
 * without `tenantId` read the issue types of every tenant, and a request naming another tenant read that tenant's.
 * The caller's tenant now scopes both reads, as the TypeORM branch and the other task metadata types do.
 */
describe('IssueTypeService.fetchAll (MikroORM) — tenant scope', () => {
	const CALLER_TENANT = 'caller-tenant';
	const defaults = { items: [{ id: 'system-default' }], total: 1 };

	let mikroOrmRepository: { findOne: jest.Mock; findAndCount: jest.Mock };
	let service: IssueTypeService;
	let getDefaultEntities: jest.SpyInstance;

	beforeEach(() => {
		mikroOrmRepository = {
			findOne: jest.fn().mockResolvedValue({ id: 'issue-type-1' }),
			findAndCount: jest.fn().mockResolvedValue([[{ id: 'issue-type-1' }], 1])
		};
		service = new IssueTypeService(
			{ metadata: { tableName: 'issue_type' } } as never,
			mikroOrmRepository as never,
			{} as never
		);
		jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(service as any, 'serialize').mockImplementation((entity) => entity);
		getDefaultEntities = jest.spyOn(service, 'getDefaultEntities').mockResolvedValue(defaults as never);
	});

	afterEach(() => jest.restoreAllMocks());

	const readWhere = () => [
		mikroOrmRepository.findOne.mock.calls[0][0],
		mikroOrmRepository.findAndCount.mock.calls[0][0]
	];

	it("reads the caller's tenant when the query has no tenantId", async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(CALLER_TENANT);

		await expect(service.fetchAll({ organizationId: 'organization-1' })).resolves.toEqual({
			items: [{ id: 'issue-type-1' }],
			total: 1
		});

		for (const where of readWhere()) {
			expect(where).toEqual({
				tenantId: CALLER_TENANT,
				organizationId: 'organization-1',
				organizationTeamId: null,
				projectId: null
			});
		}
	});

	it("reads the caller's tenant when the query names another one", async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(CALLER_TENANT);

		await service.fetchAll({ tenantId: 'other-tenant', organizationId: 'organization-1' });

		for (const where of readWhere()) {
			expect(where).toMatchObject({ tenantId: CALLER_TENANT });
		}
	});

	it('answers the system defaults without reading when no tenant is known', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);

		await expect(service.fetchAll({ organizationId: 'organization-1' })).resolves.toBe(defaults);

		expect(mikroOrmRepository.findOne).not.toHaveBeenCalled();
		expect(mikroOrmRepository.findAndCount).not.toHaveBeenCalled();
		expect(getDefaultEntities).toHaveBeenCalledTimes(1);
	});

	it('still reads the tenant a query names when there is no request tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);

		await service.fetchAll({ tenantId: 'query-tenant' });

		for (const where of readWhere()) {
			expect(where).toEqual({
				tenantId: 'query-tenant',
				organizationId: null,
				organizationTeamId: null,
				projectId: null
			});
		}
	});
});

/**
 * The MikroORM branch of `fetchAll` added only the scope columns a request supplied, while the TypeORM branch
 * (`getFilterQuery`) pins every other one to NULL: an organization-level request read the issue types of the
 * organization's projects and teams as well. Both branches now read the same scope.
 */
describe('IssueTypeService.fetchAll (MikroORM) — scopes the request leaves out are NULL', () => {
	const TENANT = 'caller-tenant';

	let mikroOrmRepository: { findOne: jest.Mock; findAndCount: jest.Mock };
	let service: IssueTypeService;

	beforeEach(() => {
		mikroOrmRepository = {
			findOne: jest.fn().mockResolvedValue({ id: 'issue-type-1' }),
			findAndCount: jest.fn().mockResolvedValue([[{ id: 'issue-type-1' }], 1])
		};
		service = new IssueTypeService(
			{ metadata: { tableName: 'issue_type' } } as never,
			mikroOrmRepository as never,
			{} as never
		);
		jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(service as any, 'serialize').mockImplementation((entity) => entity);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	const readWhere = () => [
		mikroOrmRepository.findOne.mock.calls[0][0],
		mikroOrmRepository.findAndCount.mock.calls[0][0]
	];

	it('reads only the organization-level issue types for an organization-level request', async () => {
		await service.fetchAll({ organizationId: 'organization-1' });

		for (const where of readWhere()) {
			expect(where).toEqual({
				tenantId: TENANT,
				organizationId: 'organization-1',
				organizationTeamId: null,
				projectId: null
			});
		}
	});

	it('reads the project scope a request supplies, the team still pinned to NULL', async () => {
		await service.fetchAll({ organizationId: 'organization-1', projectId: 'project-1' });

		for (const where of readWhere()) {
			expect(where).toEqual({
				tenantId: TENANT,
				organizationId: 'organization-1',
				organizationTeamId: null,
				projectId: 'project-1'
			});
		}
	});
});
