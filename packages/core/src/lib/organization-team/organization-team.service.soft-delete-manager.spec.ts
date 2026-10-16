import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import {
	Collection,
	Entity,
	EntityCaseNamingStrategy,
	ManyToOne,
	MikroORM,
	OneToMany,
	PrimaryKey,
	Property
} from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { OrganizationTeamService } from './organization-team.service';

/**
 * #10704 — `DELETE /organization-team/:id/soft` / `softDeleteOrganizationTeam` and
 * `PUT /organization-team/:id/recover` / `recoverOrganizationTeam` ran the CRUD base's `softRemove` and
 * `softRecover`, which check the tenant only: any employee holding ORG_TEAM_EDIT retired or restored a team
 * they do not manage. Both now apply the rule `deleteTeam` applies: without CHANGE_SELECTED_EMPLOYEE, the
 * caller must be an employee with a MANAGER membership of the team, in the team's tenant and organization.
 *
 * Each case runs the service's real `softRemove` / `softRecover` — the override and the CRUD base under it —
 * against a real in-memory SQLite database under each ORM, with the soft-delete mechanism each ORM uses in
 * production: MikroORM's `@SoftDeletable` filter, and TypeORM's delete-date column.
 */

const TENANT = '70000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '70000000-0000-4000-8000-0000000000a1';
/** A tenant and an organization the teams are not part of. */
const OTHER_TENANT = '70000000-0000-4000-8000-00000000000b';
const OTHER_ORGANIZATION = '70000000-0000-4000-8000-0000000000b1';
const RETIRED_AT = new Date('2026-01-01T00:00:00.000Z');

const MANAGER_ROLE = '70000000-0000-4000-8000-0000000000f1';

/** The live team and the retired one, both managed by EMPLOYEE.manager. */
const LIVE_TEAM = '70000000-0000-4000-8000-000000000001';
const RETIRED_TEAM = '70000000-0000-4000-8000-000000000002';
/** A team only EMPLOYEE.otherManager manages. */
const OTHER_TEAM = '70000000-0000-4000-8000-000000000003';
/** A retired team only EMPLOYEE.otherManager manages. */
const OTHER_RETIRED_TEAM = '70000000-0000-4000-8000-000000000004';

const EMPLOYEE = {
	/** A MANAGER member of LIVE_TEAM and RETIRED_TEAM. */
	manager: '70000000-0000-4000-8000-0000000000e1',
	/** A plain member (no role) of LIVE_TEAM and RETIRED_TEAM. */
	member: '70000000-0000-4000-8000-0000000000e2',
	/** A MANAGER of OTHER_TEAM only. */
	otherManager: '70000000-0000-4000-8000-0000000000e3',
	/** A MANAGER of LIVE_TEAM and RETIRED_TEAM by membership rows that name another organization. */
	foreignOrganizationManager: '70000000-0000-4000-8000-0000000000e4',
	/** A MANAGER of LIVE_TEAM and RETIRED_TEAM by membership rows that name another tenant. */
	foreignTenantManager: '70000000-0000-4000-8000-0000000000e5'
};

const ROLES = [{ id: MANAGER_ROLE, name: RolesEnum.MANAGER }];

const TEAMS = [
	{ id: LIVE_TEAM, name: 'live', tenantId: TENANT, organizationId: ORGANIZATION, deletedAt: null },
	{ id: RETIRED_TEAM, name: 'retired', tenantId: TENANT, organizationId: ORGANIZATION, deletedAt: RETIRED_AT },
	{ id: OTHER_TEAM, name: 'other', tenantId: TENANT, organizationId: ORGANIZATION, deletedAt: null },
	{
		id: OTHER_RETIRED_TEAM,
		name: 'other retired',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		deletedAt: RETIRED_AT
	}
];

/** In the team's own tenant and organization unless the row says otherwise. */
const MEMBERS = [
	{
		id: '70000000-0000-4000-8000-0000000000c1',
		teamId: LIVE_TEAM,
		employeeId: EMPLOYEE.manager,
		roleId: MANAGER_ROLE
	},
	{ id: '70000000-0000-4000-8000-0000000000c2', teamId: LIVE_TEAM, employeeId: EMPLOYEE.member, roleId: null },
	{
		id: '70000000-0000-4000-8000-0000000000c3',
		teamId: RETIRED_TEAM,
		employeeId: EMPLOYEE.manager,
		roleId: MANAGER_ROLE
	},
	{ id: '70000000-0000-4000-8000-0000000000c4', teamId: RETIRED_TEAM, employeeId: EMPLOYEE.member, roleId: null },
	{
		id: '70000000-0000-4000-8000-0000000000c5',
		teamId: OTHER_TEAM,
		employeeId: EMPLOYEE.otherManager,
		roleId: MANAGER_ROLE
	},
	{
		id: '70000000-0000-4000-8000-0000000000ca',
		teamId: OTHER_RETIRED_TEAM,
		employeeId: EMPLOYEE.otherManager,
		roleId: MANAGER_ROLE
	},
	{
		id: '70000000-0000-4000-8000-0000000000c6',
		teamId: LIVE_TEAM,
		employeeId: EMPLOYEE.foreignOrganizationManager,
		roleId: MANAGER_ROLE,
		organizationId: OTHER_ORGANIZATION
	},
	{
		id: '70000000-0000-4000-8000-0000000000c7',
		teamId: RETIRED_TEAM,
		employeeId: EMPLOYEE.foreignOrganizationManager,
		roleId: MANAGER_ROLE,
		organizationId: OTHER_ORGANIZATION
	},
	{
		id: '70000000-0000-4000-8000-0000000000c8',
		teamId: LIVE_TEAM,
		employeeId: EMPLOYEE.foreignTenantManager,
		roleId: MANAGER_ROLE,
		tenantId: OTHER_TENANT
	},
	{
		id: '70000000-0000-4000-8000-0000000000c9',
		teamId: RETIRED_TEAM,
		employeeId: EMPLOYEE.foreignTenantManager,
		roleId: MANAGER_ROLE,
		tenantId: OTHER_TENANT
	}
].map((member) => ({ tenantId: TENANT, organizationId: ORGANIZATION, ...member }));

/*
|--------------------------------------------------------------------------
| TypeORM: the three tables, with the relations the manager check walks
|--------------------------------------------------------------------------
*/

const RoleSchema = new EntitySchema<any>({
	name: 'Role',
	tableName: 'role',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
	}
});

// `deleteDate` is what makes TypeORM's soft remove and recover write `deletedAt`, and its reads skip a
// retired row unless asked `withDeleted`.
const OrganizationTeamSchema = new EntitySchema<any>({
	name: 'OrganizationTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		members: { type: 'one-to-many', target: 'OrganizationTeamEmployee', inverseSide: 'organizationTeam' }
	}
});

const OrganizationTeamEmployeeSchema = new EntitySchema<any>({
	name: 'OrganizationTeamEmployee',
	tableName: 'organization_team_employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		organizationTeamId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		roleId: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	},
	relations: {
		organizationTeam: {
			type: 'many-to-one',
			target: 'OrganizationTeam',
			inverseSide: 'members',
			joinColumn: { name: 'organizationTeamId' }
		},
		role: { type: 'many-to-one', target: 'Role', joinColumn: { name: 'roleId' }, nullable: true }
	}
});

/*
|--------------------------------------------------------------------------
| MikroORM: the same tables, soft-deletable the way `SoftDeletableBaseEntity` is
|--------------------------------------------------------------------------
*/

@Entity({ tableName: 'role' })
class RoleRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;
}

@SoftDeletable(() => OrganizationTeamRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'organization_team' })
class OrganizationTeamRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;

	@OneToMany(() => OrganizationTeamEmployeeRow, (member) => member.organizationTeam)
	members = new Collection<OrganizationTeamEmployeeRow>(this);
}

@Entity({ tableName: 'organization_team_employee' })
class OrganizationTeamEmployeeRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@ManyToOne(() => OrganizationTeamRow, { fieldName: 'organizationTeamId' })
	organizationTeam!: OrganizationTeamRow;

	@Property({ type: 'string' })
	employeeId!: string;

	@ManyToOne(() => RoleRow, { fieldName: 'roleId', nullable: true })
	role?: RoleRow | null;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;
}

/**
 * The service over one ORM's repository. The collaborators it names are never reached by `softRemove` or
 * `softRecover`, so they are empty objects: a call that did reach one would fail loudly.
 */
function serviceOver(typeOrmRepository: unknown, mikroOrmRepository: unknown): OrganizationTeamService {
	return new OrganizationTeamService(
		typeOrmRepository as any,
		mikroOrmRepository as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any
	);
}

/** One ORM's database, the service over it, and the stored `deletedAt` of a team. */
interface IHarness {
	service(): OrganizationTeamService;
	deletedAt(teamId: string): Promise<unknown>;
	reset(): Promise<void>;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [RoleSchema, OrganizationTeamSchema, OrganizationTeamEmployeeSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const teams: Repository<any> = dataSource.getRepository('OrganizationTeam');

	return {
		service: () => serviceOver(teams, {}),
		deletedAt: async (teamId) =>
			(await dataSource.query('SELECT deletedAt FROM organization_team WHERE id = ?', [teamId]))[0]?.deletedAt,
		reset: async () => {
			await dataSource.query('DELETE FROM organization_team_employee');
			await dataSource.query('DELETE FROM organization_team');
			await dataSource.query('DELETE FROM role');
			await dataSource.getRepository('Role').save(ROLES);
			await teams.save(TEAMS);
			await dataSource
				.getRepository('OrganizationTeamEmployee')
				.save(MEMBERS.map(({ teamId, ...member }) => ({ ...member, organizationTeamId: teamId })));
		},
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [RoleRow, OrganizationTeamRow, OrganizationTeamEmployeeRow],
		// Columns named as the properties, as the platform's tables name them.
		namingStrategy: EntityCaseNamingStrategy,
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	return {
		// A fresh fork per service, so a row is answered because the store answered it rather than because
		// the seeding context still held it.
		service: () =>
			serviceOver({}, new MikroOrmBaseEntityRepository<any>(orm.em.fork() as any, OrganizationTeamRow)),
		deletedAt: async (teamId) =>
			(await orm.em.getConnection().execute('SELECT deletedAt FROM organization_team WHERE id = ?', [teamId]))[0]
				?.deletedAt,
		reset: async () => {
			const connection = orm.em.getConnection();
			await connection.execute('DELETE FROM organization_team_employee');
			await connection.execute('DELETE FROM organization_team');
			await connection.execute('DELETE FROM role');

			const em = orm.em.fork();
			em.persist(ROLES.map((role) => em.create(RoleRow, role)));
			em.persist(TEAMS.map((team) => em.create(OrganizationTeamRow, team)));
			em.persist(
				MEMBERS.map(({ teamId, roleId, ...member }) =>
					em.create(OrganizationTeamEmployeeRow, { ...member, organizationTeam: teamId, role: roleId })
				)
			);
			await em.flush();
		},
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('OrganizationTeamService soft delete and restore check the team manager (%s)', (ormType, createHarness) => {
	let harness: IHarness;

	beforeAll(async () => {
		harness = await createHarness();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		await harness.reset();

		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		// No signed-in user: the tenant-aware lookup adds nothing, so the cases isolate the manager check.
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * The caller: an employee, with or without CHANGE_SELECTED_EMPLOYEE. As in production, a holder of that
	 * permission has no current employee id.
	 */
	const signInAs = (employeeId: string | null, canChangeSelectedEmployee = false) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(canChangeSelectedEmployee ? null : employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) =>
				canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	};

	describe('soft delete', () => {
		it('refuses a plain member of the team, and the team stays live', async () => {
			signInAs(EMPLOYEE.member);

			await expect(harness.service().softRemove(LIVE_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(LIVE_TEAM)).toBeNull();
		});

		it('refuses the manager of another team, and the team stays live', async () => {
			signInAs(EMPLOYEE.otherManager);

			await expect(harness.service().softRemove(LIVE_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(LIVE_TEAM)).toBeNull();
		});

		it('refuses a caller without an employee identity, as deleteTeam does, and the team stays live', async () => {
			signInAs(null);

			await expect(harness.service().softRemove(LIVE_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(LIVE_TEAM)).toBeNull();
		});

		it.each([
			['another organization', EMPLOYEE.foreignOrganizationManager],
			['another tenant', EMPLOYEE.foreignTenantManager]
		])('refuses a manager whose membership row names %s, and the team stays live', async (_, employeeId) => {
			signInAs(employeeId);

			await expect(harness.service().softRemove(LIVE_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(LIVE_TEAM)).toBeNull();
		});

		it('lets a manager of the team retire it', async () => {
			signInAs(EMPLOYEE.manager);

			await expect(harness.service().softRemove(LIVE_TEAM)).resolves.toMatchObject({ id: LIVE_TEAM });
			expect(await harness.deletedAt(LIVE_TEAM)).not.toBeNull();
		});

		it('retires the checked team only: a where.id in the options cannot name another team', async () => {
			signInAs(EMPLOYEE.manager);

			await expect(harness.service().softRemove(LIVE_TEAM, { where: { id: OTHER_TEAM } })).resolves.toMatchObject(
				{ id: LIVE_TEAM }
			);
			expect(await harness.deletedAt(OTHER_TEAM)).toBeNull();
			expect(await harness.deletedAt(LIVE_TEAM)).not.toBeNull();
		});

		it("takes the inherited route's rest parameter, an empty array, as no options", async () => {
			signInAs(EMPLOYEE.manager);

			await expect(harness.service().softRemove(LIVE_TEAM, [] as any)).resolves.toMatchObject({ id: LIVE_TEAM });
			expect(await harness.deletedAt(LIVE_TEAM)).not.toBeNull();
		});

		it('lets a caller with CHANGE_SELECTED_EMPLOYEE retire any team of the tenant', async () => {
			signInAs(EMPLOYEE.otherManager, true);

			await expect(harness.service().softRemove(LIVE_TEAM)).resolves.toMatchObject({ id: LIVE_TEAM });
			expect(await harness.deletedAt(LIVE_TEAM)).not.toBeNull();
		});
	});

	describe('restore', () => {
		it('refuses a plain member of the retired team, and the team stays retired', async () => {
			signInAs(EMPLOYEE.member);

			await expect(harness.service().softRecover(RETIRED_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(RETIRED_TEAM)).not.toBeNull();
		});

		it('refuses the manager of another team, and the team stays retired', async () => {
			signInAs(EMPLOYEE.otherManager);

			await expect(harness.service().softRecover(RETIRED_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(RETIRED_TEAM)).not.toBeNull();
		});

		it('refuses a caller without an employee identity, as deleteTeam does, and the team stays retired', async () => {
			signInAs(null);

			await expect(harness.service().softRecover(RETIRED_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(RETIRED_TEAM)).not.toBeNull();
		});

		it.each([
			['another organization', EMPLOYEE.foreignOrganizationManager],
			['another tenant', EMPLOYEE.foreignTenantManager]
		])('refuses a manager whose membership row names %s, and the team stays retired', async (_, employeeId) => {
			signInAs(employeeId);

			await expect(harness.service().softRecover(RETIRED_TEAM)).rejects.toThrow(ForbiddenException);
			expect(await harness.deletedAt(RETIRED_TEAM)).not.toBeNull();
		});

		it('lets a manager of the retired team restore it (the check reads retired teams)', async () => {
			signInAs(EMPLOYEE.manager);

			await expect(harness.service().softRecover(RETIRED_TEAM)).resolves.toMatchObject({ id: RETIRED_TEAM });
			expect(await harness.deletedAt(RETIRED_TEAM)).toBeNull();
		});

		it('restores the checked team only: a where.id in the options cannot name another team', async () => {
			signInAs(EMPLOYEE.manager);

			await expect(
				harness.service().softRecover(RETIRED_TEAM, { where: { id: OTHER_RETIRED_TEAM } })
			).resolves.toMatchObject({ id: RETIRED_TEAM });
			expect(await harness.deletedAt(OTHER_RETIRED_TEAM)).not.toBeNull();
			expect(await harness.deletedAt(RETIRED_TEAM)).toBeNull();
		});

		it("takes the inherited route's rest parameter, an empty array, as no options", async () => {
			signInAs(EMPLOYEE.manager);

			await expect(harness.service().softRecover(RETIRED_TEAM, [] as any)).resolves.toMatchObject({
				id: RETIRED_TEAM
			});
			expect(await harness.deletedAt(RETIRED_TEAM)).toBeNull();
		});

		it('lets a caller with CHANGE_SELECTED_EMPLOYEE restore any team of the tenant', async () => {
			signInAs(EMPLOYEE.otherManager, true);

			await expect(harness.service().softRecover(RETIRED_TEAM)).resolves.toMatchObject({ id: RETIRED_TEAM });
			expect(await harness.deletedAt(RETIRED_TEAM)).toBeNull();
		});
	});
});
