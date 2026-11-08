import '../core/entities/internal';

import { DataSource, EntitySchema } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * A team manager is the member whose row holds the MANAGER role or the manager flag. The flag is what lets a manager
 * act for the team's members, and a member promoted by another team manager, or one made manager from Ever Teams,
 * holds it without the role: the checks that only read the role refused them the team they manage.
 *
 * A flagged membership that is inactive or archived does not count, as for acting for the members. The flags are
 * NULL on legacy rows, so NULL counts as active and not archived. The check runs on a real in-memory SQLite
 * database, through the TypeORM repository it reads in production.
 */

const TENANT = '72000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '72000000-0000-4000-8000-0000000000a1';
const OTHER_TENANT = '72000000-0000-4000-8000-00000000000b';
const OTHER_ORGANIZATION = '72000000-0000-4000-8000-0000000000b1';
const TEAM = '72000000-0000-4000-8000-000000000001';
const OTHER_TEAM = '72000000-0000-4000-8000-000000000002';
const MANAGER_ROLE = '72000000-0000-4000-8000-0000000000f1';

const EMPLOYEE = {
	roleManager: '72000000-0000-4000-8000-0000000000e1',
	flaggedManager: '72000000-0000-4000-8000-0000000000e2',
	member: '72000000-0000-4000-8000-0000000000e3',
	otherTeamManager: '72000000-0000-4000-8000-0000000000e4',
	foreignTenantManager: '72000000-0000-4000-8000-0000000000e5',
	formerManager: '72000000-0000-4000-8000-0000000000e6',
	foreignOrganizationManager: '72000000-0000-4000-8000-0000000000e7',
	inactiveFlaggedManager: '72000000-0000-4000-8000-0000000000e8',
	archivedFlaggedManager: '72000000-0000-4000-8000-0000000000e9'
};

const RoleSchema = new EntitySchema<any>({
	name: 'Role',
	tableName: 'role',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
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
		isManager: { type: 'boolean', nullable: true },
		isActive: { type: 'boolean', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		role: { type: 'many-to-one', target: 'Role', joinColumn: { name: 'roleId' }, nullable: true }
	}
});

const MEMBERS = [
	{ id: 'row-1', organizationTeamId: TEAM, employeeId: EMPLOYEE.roleManager, roleId: MANAGER_ROLE, isManager: false },
	{ id: 'row-2', organizationTeamId: TEAM, employeeId: EMPLOYEE.flaggedManager, roleId: null, isManager: true },
	{ id: 'row-3', organizationTeamId: TEAM, employeeId: EMPLOYEE.member, roleId: null, isManager: false },
	{ id: 'row-4', organizationTeamId: TEAM, employeeId: EMPLOYEE.formerManager, roleId: null, isManager: null },
	{
		id: 'row-5',
		organizationTeamId: OTHER_TEAM,
		employeeId: EMPLOYEE.otherTeamManager,
		roleId: MANAGER_ROLE,
		isManager: true
	},
	{
		id: 'row-6',
		organizationTeamId: TEAM,
		employeeId: EMPLOYEE.foreignTenantManager,
		roleId: MANAGER_ROLE,
		isManager: true,
		tenantId: OTHER_TENANT
	},
	{
		id: 'row-7',
		organizationTeamId: TEAM,
		employeeId: EMPLOYEE.foreignOrganizationManager,
		roleId: MANAGER_ROLE,
		isManager: true,
		organizationId: OTHER_ORGANIZATION
	},
	{
		id: 'row-8',
		organizationTeamId: TEAM,
		employeeId: EMPLOYEE.inactiveFlaggedManager,
		roleId: null,
		isManager: true,
		isActive: false
	},
	{
		id: 'row-9',
		organizationTeamId: TEAM,
		employeeId: EMPLOYEE.archivedFlaggedManager,
		roleId: null,
		isManager: true,
		isArchived: true
	}
].map((member) => ({
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	isActive: null,
	isArchived: null,
	deletedAt: null,
	...member
}));

const TEAM_SCOPE = { tenantId: TENANT, organizationId: ORGANIZATION, organizationTeamId: TEAM };

describe('OrganizationTeamEmployeeService.isTeamManager', () => {
	let dataSource: DataSource;
	let service: OrganizationTeamEmployeeService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RoleSchema, OrganizationTeamEmployeeSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.getRepository('Role').save([{ id: MANAGER_ROLE, name: RolesEnum.MANAGER }]);
		await dataSource.getRepository('OrganizationTeamEmployee').save(MEMBERS);

		service = Object.create(OrganizationTeamEmployeeService.prototype);
		Object.assign(service, {
			typeOrmOrganizationTeamEmployeeRepository: dataSource.getRepository('OrganizationTeamEmployee')
		});
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	it.each([
		['the MANAGER role', EMPLOYEE.roleManager],
		['the manager flag, without the MANAGER role', EMPLOYEE.flaggedManager]
	])('counts a member whose row holds %s', async (_, employeeId) => {
		await expect(service.isTeamManager(employeeId, TEAM_SCOPE)).resolves.toBe(true);
	});

	it.each([
		['a plain member', EMPLOYEE.member],
		['a member whose flag is NULL and who has no role', EMPLOYEE.formerManager],
		['the manager of another team', EMPLOYEE.otherTeamManager],
		['a manager whose row names another tenant', EMPLOYEE.foreignTenantManager],
		['a manager whose row names another organization', EMPLOYEE.foreignOrganizationManager],
		['a flagged member whose membership is inactive', EMPLOYEE.inactiveFlaggedManager],
		['a flagged member whose membership is archived', EMPLOYEE.archivedFlaggedManager]
	])('refuses %s', async (_, employeeId) => {
		await expect(service.isTeamManager(employeeId, TEAM_SCOPE)).resolves.toBe(false);
	});

	it('refuses a caller without an employee id rather than matching any manager of the team', async () => {
		await expect(service.isTeamManager(undefined, TEAM_SCOPE)).resolves.toBe(false);
	});

	it('reads a soft-deleted membership only when asked to, for a restoration', async () => {
		const repository = dataSource.getRepository('OrganizationTeamEmployee');
		await repository.softDelete({ id: 'row-2' });

		await expect(service.isTeamManager(EMPLOYEE.flaggedManager, TEAM_SCOPE)).resolves.toBe(false);
		await expect(service.isTeamManager(EMPLOYEE.flaggedManager, TEAM_SCOPE, true)).resolves.toBe(true);

		await repository.restore({ id: 'row-2' });
	});
});
