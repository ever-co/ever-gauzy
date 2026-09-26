import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The approval register's two hand-rolled reads on both ORMs, over one database whose tables TypeORM created.
 *
 * Under `DB_ORM=mikro-orm` all three of the register's reads failed on the live stack, while TypeORM answered
 * each of them:
 *
 * - the list — `GET /api/request-approval` (HTTP 500) and GraphQL `requestApprovals` — answered
 *   `The operator "approval_policy.id" is not permitted`. The MikroORM branch called knex's `leftJoin` with
 *   four arguments (table, alias, column, column), and knex has no alias argument: its four-argument form is
 *   `(table, column, operator, column)`, so the first column was read as the operator and the statement could
 *   not be compiled;
 * - GraphQL `requestApprovalsByEmployee` answered `Collection<RequestApprovalEmployee> of entity Employee[…] not
 *   initialized`. The employee is read with the relations the caller names — none, from GraphQL — and the
 *   service then asked the collection it had not loaded for its length. TypeORM leaves an unloaded relation
 *   `undefined`, which the service reads as "no approvals"; a MikroORM collection refuses to be read at all.
 *
 * Each case runs the real `RequestApprovalService` over the real entities on both ORMs, against one
 * better-sqlite3 file whose tables TypeORM's mapping created (as the migrations create them in an installation),
 * and asks each ORM for the same rows. The fixtures put every branch of the list's scope in play: a request
 * admitted only through its policy, only through the time-off request or the equipment sharing it names, only
 * through its own organization, and the rows each of those joins must keep out — another tenant's, another
 * organization's, a withdrawn request, and a request whose policy or time-off request was withdrawn.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '0f7c1a2e-0000-4000-8000-00000000a001';
const OTHER_TENANT = '0f7c1a2e-0000-4000-8000-00000000a002';
const ORG = '0f7c1a2e-0000-4000-8000-00000000b001';
const OTHER_ORG = '0f7c1a2e-0000-4000-8000-00000000b002';
const USER = '0f7c1a2e-0000-4000-8000-00000000c001';
const EMPLOYEE = '0f7c1a2e-0000-4000-8000-00000000d001';

const POLICY = '0f7c1a2e-0000-4000-8000-00000000e001';
const WITHDRAWN_POLICY = '0f7c1a2e-0000-4000-8000-00000000e002';
const TIME_OFF = '0f7c1a2e-0000-4000-8000-00000000f001';
const WITHDRAWN_TIME_OFF = '0f7c1a2e-0000-4000-8000-00000000f002';
const SHARING = '0f7c1a2e-0000-4000-8000-00000000f101';

/** The requests, named by the branch of the list's scope that admits them, or the rule that keeps them out. */
const REQUEST = {
	/** Admitted by its policy alone: it names no organization of its own. */
	byPolicy: '0f7c1a2e-0000-4000-8000-000000001001',
	/** Admitted by the time-off request it is about alone. */
	byTimeOff: '0f7c1a2e-0000-4000-8000-000000001002',
	/** Admitted by the equipment sharing it is about alone. */
	bySharing: '0f7c1a2e-0000-4000-8000-000000001003',
	/** Admitted by its own organization alone — a purchasing request names no policy and no record. */
	byOwnOrganization: '0f7c1a2e-0000-4000-8000-000000001004',
	/** Another organization's, in the caller's tenant. */
	otherOrganization: '0f7c1a2e-0000-4000-8000-000000001005',
	/** The caller's organization id, but another tenant's row. */
	otherTenant: '0f7c1a2e-0000-4000-8000-000000001006',
	/** The caller's own organization, but withdrawn. */
	withdrawn: '0f7c1a2e-0000-4000-8000-000000001007',
	/** Its policy is the caller's, but the policy was withdrawn. */
	withdrawnPolicy: '0f7c1a2e-0000-4000-8000-000000001008',
	/** Its time-off request is the caller's, but the time-off request was withdrawn. */
	withdrawnTimeOff: '0f7c1a2e-0000-4000-8000-000000001009'
};

/** The requests the employee is asked to answer, through the pivot, and one ask that was withdrawn. */
const APPROVAL = {
	timeOff: '0f7c1a2e-0000-4000-8000-000000002001',
	sharing: '0f7c1a2e-0000-4000-8000-000000002002',
	withdrawn: '0f7c1a2e-0000-4000-8000-000000002003'
};

const WITHDRAWN_AT = '2026-01-02 00:00:00.000';

const sorted = (ids: string[]): string[] => [...ids].sort();

describe('RequestApprovalService reads the same register on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-request-approval-parity-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;

	/** A service over both ORMs' repositories, as the module builds it, answering on the ORM named. */
	const service = (ormType: Orm): any => {
		const em = orm.em.fork();
		const instance = new loaded.RequestApprovalService(
			new loaded.TypeOrmRequestApprovalRepository(dataSource.getRepository(loaded.RequestApproval)),
			new loaded.MikroOrmRequestApprovalRepository(em, loaded.RequestApproval),
			new loaded.TypeOrmEmployeeRepository(dataSource.getRepository(loaded.Employee)),
			new loaded.MikroOrmEmployeeRepository(em, loaded.Employee),
			new loaded.TypeOrmOrganizationTeamRepository(dataSource.getRepository(loaded.OrganizationTeam)),
			new loaded.MikroOrmOrganizationTeamRepository(em, loaded.OrganizationTeam)
		);
		// The ORM is a module constant of the CRUD base, read when the registry loaded (MikroORM, here); each
		// instance states its own so one registry can run both halves over the same mapping.
		Object.defineProperty(instance, 'ormType', { get: () => ormType });
		return instance;
	};

	const insert = async (table: string, row: Row): Promise<void> => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) => row[column])
		);
	};

	const request = (id: string, row: Row): Promise<void> =>
		insert('request_approval', { id, name: `request ${id.slice(-4)}`, status: 1, min_count: 1, ...row });

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				// MikroORM keeps decorator metadata in a process-wide store; this load's decorators write the
				// mapping under test into an empty one.
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../core/entities/internal');

				const { coreEntities } = require('../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
				const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');

				loaded = {
					RequestApproval: entities.RequestApproval,
					Employee: entities.Employee,
					OrganizationTeam: entities.OrganizationTeam,
					RequestContext: require('../core/context/request-context').RequestContext,
					RequestApprovalService: require('./request-approval.service').RequestApprovalService,
					RequestApprovalResolver: require('./request-approval.resolver').RequestApprovalResolver,
					TypeOrmRequestApprovalRepository: require('./repository/type-orm-request-approval.repository')
						.TypeOrmRequestApprovalRepository,
					MikroOrmRequestApprovalRepository: require('./repository/mikro-orm-request-approval.repository')
						.MikroOrmRequestApprovalRepository,
					TypeOrmEmployeeRepository: require('../employee/repository/type-orm-employee.repository')
						.TypeOrmEmployeeRepository,
					MikroOrmEmployeeRepository: require('../employee/repository/mikro-orm-employee.repository')
						.MikroOrmEmployeeRepository,
					TypeOrmOrganizationTeamRepository: require('../organization-team/repository/type-orm-organization-team.repository')
						.TypeOrmOrganizationTeamRepository,
					MikroOrmOrganizationTeamRepository: require('../organization-team/repository/mikro-orm-organization-team.repository')
						.MikroOrmOrganizationTeamRepository
				};

				// TypeORM creates the tables, as the migrations do in an installation; both ORMs then read them.
				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				// Discovery calls the relation callbacks, and the base entity reaches `User` through a `require` in
				// them, so MikroORM is initialised inside this registry too. It joins only what a read populates, as
				// the platform's MikroORM does (`@gauzy/config`, see `database-helpers.ts`) and as TypeORM does.
				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					namingStrategy: EntityCaseNamingStrategy,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		// The placeholder column of the custom-fields embeddables, which MikroORM selects whenever it joins a tag
		// or an employee. An installation has it from the custom-fields migrations (1713275626299, 1714319484155);
		// `synchronize` does not create it, because TypeORM's embeddable gets it at bootstrap, when the
		// application registers its custom fields.
		for (const table of ['employee', 'tag', 'organization_project']) {
			const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
			if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
				await dataSource.query(`ALTER TABLE "${table}" ADD "fix_relational_custom_fields" boolean`);
			}
		}

		// The fixtures name rows of tables this suite has no reason to fill (users, policies' owners, the
		// equipment); the reads under test never follow those keys.
		await dataSource.query('PRAGMA foreign_keys = OFF');

		const scope = { tenantId: TENANT, organizationId: ORG };

		// TypeORM scopes a read by the tenant relation as well as the column, so the tenants exist.
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('tenant', { id: OTHER_TENANT, name: 'other tenant' });

		await insert('approval_policy', { id: POLICY, name: 'policy', ...scope });
		await insert('approval_policy', { id: WITHDRAWN_POLICY, name: 'withdrawn policy', ...scope, deletedAt: WITHDRAWN_AT });

		const timeOff = { start: '2026-02-01 00:00:00.000', end: '2026-02-02 00:00:00.000', requestDate: '2026-01-15 00:00:00.000', status: 'REQUESTED', policyId: POLICY };
		await insert('time_off_request', { id: TIME_OFF, ...timeOff, ...scope });
		await insert('time_off_request', { id: WITHDRAWN_TIME_OFF, ...timeOff, ...scope, deletedAt: WITHDRAWN_AT });
		await insert('equipment_sharing', { id: SHARING, name: 'sharing', status: 1, ...scope });

		await insert('employee', { id: EMPLOYEE, userId: USER, ...scope });

		await request(REQUEST.byPolicy, { tenantId: TENANT, approvalPolicyId: POLICY, createdByUserId: USER });
		await request(REQUEST.byTimeOff, { tenantId: TENANT, requestId: TIME_OFF, requestType: 'TIME_OFF' });
		await request(REQUEST.bySharing, { tenantId: TENANT, requestId: SHARING, requestType: 'EQUIPMENT_SHARING' });
		await request(REQUEST.byOwnOrganization, { ...scope, requestType: 'PURCHASE_ORDER', createdByUserId: USER });
		await request(REQUEST.otherOrganization, { tenantId: TENANT, organizationId: OTHER_ORG, createdByUserId: USER });
		await request(REQUEST.otherTenant, { tenantId: OTHER_TENANT, organizationId: ORG, createdByUserId: USER });
		await request(REQUEST.withdrawn, { ...scope, createdByUserId: USER, deletedAt: WITHDRAWN_AT });
		await request(REQUEST.withdrawnPolicy, { tenantId: TENANT, approvalPolicyId: WITHDRAWN_POLICY });
		await request(REQUEST.withdrawnTimeOff, { tenantId: TENANT, requestId: WITHDRAWN_TIME_OFF });

		const approver = { employeeId: EMPLOYEE, status: 1, ...scope };
		await insert('request_approval_employee', { id: APPROVAL.timeOff, requestApprovalId: REQUEST.byTimeOff, ...approver });
		await insert('request_approval_employee', { id: APPROVAL.sharing, requestApprovalId: REQUEST.bySharing, ...approver });
		await insert('request_approval_employee', {
			id: APPROVAL.withdrawn,
			requestApprovalId: REQUEST.otherOrganization,
			...approver,
			deletedAt: WITHDRAWN_AT
		});
	}, TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		try {
			fs.unlinkSync(file);
		} catch {
			// The file is the operating system's temporary directory's to reclaim.
		}
	});

	beforeEach(() => {
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT, employeeId: EMPLOYEE });
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
		jest.spyOn(context, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the list (GET /request-approval, GraphQL requestApprovals)', () => {
		const expected = sorted([REQUEST.byPolicy, REQUEST.byTimeOff, REQUEST.bySharing, REQUEST.byOwnOrganization]);

		it.each(ORMS)('answers the caller organization\'s requests on %s', async (ormType) => {
			const { items, total } = await service(ormType).findAllRequestApprovals({ relations: [] }, {});

			expect(sorted(items.map((item: Row) => item.id))).toEqual(expected);
			expect(total).toBe(expected.length);
		});

		it.each(ORMS)('answers the organization the input names on %s', async (ormType) => {
			const { items } = await service(ormType).findAllRequestApprovals({ relations: [] }, { organizationId: OTHER_ORG });

			expect(items.map((item: Row) => item.id)).toEqual([REQUEST.otherOrganization]);
		});

		it.each(ORMS)('carries the approval policy it joins, and the relations the caller names, on %s', async (ormType) => {
			const { items } = await service(ormType).findAllRequestApprovals({ relations: ['employeeApprovals'] }, {});
			const byId = new Map<string, Row>(items.map((item: Row) => [item.id, item]));

			expect(byId.get(REQUEST.byPolicy).approvalPolicy).toEqual(expect.objectContaining({ id: POLICY, name: 'policy' }));
			expect(byId.get(REQUEST.byTimeOff).employeeApprovals.map((row: Row) => row.id)).toEqual([APPROVAL.timeOff]);
			expect(byId.get(REQUEST.byOwnOrganization).employeeApprovals).toEqual([]);
		});

		it('answers GraphQL requestApprovals on MikroORM with the rows TypeORM answers', async () => {
			const connection = async (ormType: Orm) =>
				(await new loaded.RequestApprovalResolver(service(ormType), {} as never).requestApprovals()).edges.map(
					(edge: Row) => edge.node.id
				);

			expect(sorted(await connection('mikro-orm'))).toEqual(expected);
			expect(await connection('mikro-orm')).toEqual(await connection('typeorm'));
		});
	});

	describe('the requests of one employee (GET /request-approval/employee/:id, GraphQL requestApprovalsByEmployee)', () => {
		it.each(ORMS)('answers, without the approval collection, the requests the caller raised there on %s', async (ormType) => {
			const { items, total } = await service(ormType).findRequestApprovalsByEmployeeId(EMPLOYEE, [], {});

			expect(items.map((item: Row) => item.id)).toEqual([REQUEST.byOwnOrganization]);
			expect(total).toBe(1);
		});

		it.each(ORMS)('adds, with the approval collection, the requests the employee is asked to answer on %s', async (ormType) => {
			const { items } = await service(ormType).findRequestApprovalsByEmployeeId(EMPLOYEE, ['requestApprovals'], {});

			expect(sorted(items.map((item: Row) => item.id))).toEqual(
				sorted([REQUEST.byOwnOrganization, REQUEST.byTimeOff, REQUEST.bySharing])
			);
			const byTimeOff = items.find((item: Row) => item.id === REQUEST.byTimeOff);
			expect(byTimeOff.employeeApprovals.map((row: Row) => row.id)).toEqual([APPROVAL.timeOff]);
		});

		it('answers GraphQL requestApprovalsByEmployee on MikroORM with the rows TypeORM answers', async () => {
			const connection = async (ormType: Orm) =>
				(
					await new loaded.RequestApprovalResolver(service(ormType), {} as never).requestApprovalsByEmployee(EMPLOYEE)
				).edges.map((edge: Row) => edge.node.id);

			expect(await connection('mikro-orm')).toEqual([REQUEST.byOwnOrganization]);
			expect(await connection('mikro-orm')).toEqual(await connection('typeorm'));
		});
	});
});
