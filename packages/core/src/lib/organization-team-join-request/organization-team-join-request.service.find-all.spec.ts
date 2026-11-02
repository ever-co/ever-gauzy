import '../core/entities/internal';

import { DataSource, EntitySchema as TypeOrmEntitySchema, FindManyOptions, In } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

/**
 * #11462: the join request list answered every request of the organization, applicant emails and names included,
 * to anyone holding ORG_TEAM_JOIN_REQUEST_VIEW, which every employee has. Without ALL_ORG_VIEW,
 * ORG_TEAM_JOIN_REQUEST_EDIT or CHANGE_SELECTED_EMPLOYEE it now holds only the requests of the teams the caller
 * manages or created, the teams accept and reject let them act on.
 *
 * Each case runs the real service and its CRUD base on a real in-memory better-sqlite3 store per ORM, both holding
 * the same rows, so the items and the total are what each ORM answers for the narrowed read. Only the two reads of
 * the caller's teams are stubbed, as the accept spec stubs them.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const USER = 'user-1';
const EMPLOYEE = 'employee-1';

/** Teams the caller manages through a membership, one flagged `isManager` and one with the team role MANAGER. */
const TEAM_FLAGGED = 'team-flagged';
const TEAM_LED = 'team-led';
/** A team the caller created. */
const TEAM_CREATED = 'team-created';
/** A team the caller neither manages nor created. */
const TEAM_OTHER = 'team-other';

/** An applicant who asked to join a team the caller manages and the team they cannot act on. */
const APPLICANT = 'applicant@ever.co';

/** One request per team the caller may act on, and two for the team they may not. */
const ROWS: ReadonlyArray<[id: string, organizationTeamId: string, email: string]> = [
	['request-1', TEAM_FLAGGED, APPLICANT],
	['request-2', TEAM_LED, 'second@ever.co'],
	['request-3', TEAM_CREATED, 'third@ever.co'],
	['request-4', TEAM_OTHER, APPLICANT],
	['request-5', TEAM_OTHER, 'fifth@ever.co']
];

const REQUESTS_CALLER_MAY_ACT_ON = ['request-1', 'request-2', 'request-3'];
const EVERY_REQUEST = ['request-1', 'request-2', 'request-3', 'request-4', 'request-5'];

/** The columns of a join request the list reads. */
interface IListedRequest {
	id: string;
	tenantId: string | null;
	organizationId: string | null;
	organizationTeamId: string;
	email: string;
}

/** The tenant table the CRUD base scopes a TypeORM read with, through an `EXISTS` on the tenant relation. */
const TypeOrmTenantSchema = new TypeOrmEntitySchema<{ id: string }>({
	name: 'JoinRequestListTenant',
	tableName: 'join_request_list_tenant',
	columns: {
		id: { primary: true, type: 'varchar' }
	}
});

/** A join request, its tenant declared as `TenantOrganizationBaseEntity` declares it: the relation and its id. */
const TypeOrmRequestSchema = new TypeOrmEntitySchema<IListedRequest & { tenant?: unknown }>({
	name: 'JoinRequestListRow',
	tableName: 'join_request_list_row',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		organizationTeamId: { type: 'varchar' },
		email: { type: 'varchar' }
	},
	relations: {
		tenant: {
			type: 'many-to-one',
			target: 'JoinRequestListTenant',
			joinColumn: { name: 'tenantId' },
			nullable: true
		}
	}
});

class JoinRequestListRow {
	id!: string;
	tenantId?: string | null;
	organizationId?: string | null;
	organizationTeamId!: string;
	email!: string;
}

const MikroOrmRequestSchema = new EntitySchema<JoinRequestListRow>({
	class: JoinRequestListRow,
	tableName: 'join_request_list_row',
	properties: {
		id: { type: 'string', primary: true },
		tenantId: { type: 'string', nullable: true },
		organizationId: { type: 'string', nullable: true },
		organizationTeamId: { type: 'string' },
		email: { type: 'string' }
	}
});

/** Plain SQL, the same on both stores, so the rows do not depend on the code under test. */
const CREATE_REQUEST_TABLE =
	'CREATE TABLE join_request_list_row (id varchar PRIMARY KEY NOT NULL, tenantId varchar NULL, ' +
	'organizationId varchar NULL, organizationTeamId varchar NOT NULL, email varchar NOT NULL)';
const INSERT_TENANT = 'INSERT INTO join_request_list_tenant (id) VALUES (?)';
const INSERT_REQUEST =
	'INSERT INTO join_request_list_row (id, tenantId, organizationId, organizationTeamId, email) VALUES (?, ?, ?, ?, ?)';

/**
 * The signed-in employee, with the permissions a case grants. Their role, EMPLOYEE, keeps them inside the
 * organization of their token, as in production.
 */
function signedInEmployee(permissions: PermissionsEnum[]) {
	return {
		id: USER,
		tenantId: TENANT,
		employeeId: EMPLOYEE,
		lastOrganizationId: ORGANIZATION,
		role: { name: RolesEnum.EMPLOYEE },
		permissions
	};
}

/** The ids of the rows a read answered, sorted. */
function sortedIdsOf(rows: ReadonlyArray<{ id?: string }>): string[] {
	const ids = rows.map((row) => row.id);
	return ids.sort();
}

describe('OrganizationTeamJoinRequestService.findAll lists only the requests the caller may act on (#11462)', () => {
	let dataSource: DataSource;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TypeOrmTenantSchema, TypeOrmRequestSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [MikroOrmRequestSchema],
			// The platform's own naming strategy (packages/config/src/lib/database.ts).
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		const connection = orm.em.getConnection();
		await connection.execute(CREATE_REQUEST_TABLE);

		await dataSource.query(INSERT_TENANT, [TENANT]);
		for (const [id, organizationTeamId, email] of ROWS) {
			const values = [id, TENANT, ORGANIZATION, organizationTeamId, email];
			await dataSource.query(INSERT_REQUEST, values);
			await connection.execute(INSERT_REQUEST, values);
		}
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('on %s', (ormType) => {
		let memberships: { find: jest.Mock };
		let teams: { find: jest.Mock };
		let service: OrganizationTeamJoinRequestService;

		const signIn = (permissions: PermissionsEnum[] = []) => {
			const user = signedInEmployee(permissions);
			const currentUser = jest.spyOn(RequestContext, 'currentUser');
			currentUser.mockReturnValue(user as never);
		};

		/** The ids the list answered, sorted, and its total. */
		const list = async (options?: FindManyOptions<OrganizationTeamJoinRequest>) => {
			const { items, total } = await service.findAll(options);
			const ids = sortedIdsOf(items);
			return { ids, total };
		};

		beforeEach(() => {
			const ormTypeGetter = jest.spyOn(CrudService.prototype, 'ormType', 'get');
			ormTypeGetter.mockReturnValue(ormType);
			signIn();

			const managedTeams = [{ organizationTeamId: TEAM_FLAGGED }, { organizationTeamId: TEAM_LED }];
			memberships = { find: jest.fn(async () => managedTeams) };
			teams = { find: jest.fn(async () => [{ id: TEAM_CREATED }]) };

			const typeOrmRequests = dataSource.getRepository(TypeOrmRequestSchema);
			const mikroOrmRequests = orm.em.getRepository(JoinRequestListRow);
			const unused = {} as never;
			service = new OrganizationTeamJoinRequestService(
				typeOrmRequests as never,
				mikroOrmRequests as never,
				unused, // typeOrmUserRepository
				memberships as never,
				unused, // EmployeeService
				teams as never,
				unused, // EmailService
				unused, // InviteService
				unused, // RoleService
				unused // LoginAttemptService
			);
		});

		afterEach(() => jest.restoreAllMocks());

		it('lists the requests of the teams the caller manages or created, and of no other team', async () => {
			const listed = await list();

			expect(listed).toEqual({ ids: REQUESTS_CALLER_MAY_ACT_ON, total: 3 });
			// The teams are read as accept and reject check them, inside the caller's tenant.
			const managerRoles = In([RolesEnum.MANAGER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN]);
			expect(memberships.find).toHaveBeenCalledWith({
				where: [
					{ tenantId: TENANT, employeeId: EMPLOYEE, isManager: true },
					{ tenantId: TENANT, employeeId: EMPLOYEE, role: { name: managerRoles } }
				],
				select: { organizationTeamId: true }
			});
			expect(teams.find).toHaveBeenCalledWith({
				where: { tenantId: TENANT, createdByUserId: USER },
				select: { id: true }
			});
		});

		it('lists nothing to a caller who manages and created no team', async () => {
			memberships.find.mockResolvedValue([]);
			teams.find.mockResolvedValue([]);

			const listed = await list();

			expect(listed).toEqual({ ids: [], total: 0 });
		});

		it.each([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT,
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		])('lists the requests of every team with %s, without reading the caller teams', async (permission) => {
			signIn([permission]);

			const listed = await list();

			expect(listed).toEqual({ ids: EVERY_REQUEST, total: 5 });
			expect(memberships.find).not.toHaveBeenCalled();
			expect(teams.find).not.toHaveBeenCalled();
		});

		it('keeps a filter on a team the caller manages', async () => {
			const where = { organizationTeamId: TEAM_FLAGGED };

			const listed = await list({ where });

			expect(listed).toEqual({ ids: ['request-1'], total: 1 });
		});

		it('lists nothing for a filter on a team the caller cannot act on', async () => {
			const where = { organizationTeamId: TEAM_OTHER };

			const listed = await list({ where });

			expect(listed).toEqual({ ids: [], total: 0 });
		});

		it('keeps a filter on several teams to the ones the caller may act on', async () => {
			const where = { organizationTeamId: In([TEAM_FLAGGED, TEAM_OTHER]) };

			const listed = await list({ where });

			expect(listed).toEqual({ ids: ['request-1'], total: 1 });
		});

		it('keeps every alternative of an OR to the teams the caller may act on', async () => {
			// The applicant of request-1 also asked to join the team the caller cannot act on (request-4).
			const where = [{ organizationTeamId: TEAM_OTHER }, { email: APPLICANT }];

			const listed = await list({ where });

			expect(listed).toEqual({ ids: ['request-1'], total: 1 });
		});

		it('reads an empty list of alternatives as no condition, inside the teams the caller may act on', async () => {
			const listed = await list({ where: [] });

			expect(listed).toEqual({ ids: REQUESTS_CALLER_MAY_ACT_ON, total: 3 });
		});

		it('pages the narrowed list, and counts all of it', async () => {
			const thirdRowOnward = { order: { id: 'ASC' as const }, skip: 2, take: 2 };

			const { items, total } = await service.findAll(thirdRowOnward);

			const ids = items.map((item) => item.id);
			expect(ids).toEqual(['request-3']);
			expect(total).toBe(3);
		});
	});
});
