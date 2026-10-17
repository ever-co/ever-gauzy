import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { IOrganizationProjectModuleFindInput, PermissionsEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectModuleService } from './organization-project-module.service';

/**
 * #10720 — on TypeORM the module lists by employee (`GET /organization-project-modules/employee`,
 * `employeeProjectModules`), by team (`GET /organization-project-modules/team`, `teamProjectModules`) and by a
 * named employee (`GET /organization-project-modules/employee/:id`, `organizationProjectModulesByEmployee`)
 * answered 400 on every call. The employee and team queries filtered on `organization_project_module_members`,
 * the junction alias of the many-to-many `members` used to be, and the employee subquery read its old table
 * `project_module_employee`; `findByEmployee` joined the quoted path `"organizationSprints"`, which TypeORM does
 * not resolve, and compared the member row's own id with the employee id. Once the team query runs, its project
 * alternative must stay inside the tenant and organization scope.
 *
 * Each case runs the service's real TypeORM branch against a real in-memory SQLite database whose tables carry
 * the mapping of the platform: `members` is a one-to-many to `organization_project_module_employee`, `teams` and
 * `organizationSprints` are many-to-many over `project_module_team` and `project_module_sprint`, and a team's
 * members are rows of `organization_team_employee`. The caller is an employee without CHANGE_SELECTED_EMPLOYEE.
 */

const TENANT_A = '70000000-0000-4000-8000-00000000000a';
const TENANT_B = '70000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = '70000000-0000-4000-8000-0000000000a1';
const ME = '70000000-0000-4000-8000-0000000000e1';
const COLLEAGUE = '70000000-0000-4000-8000-0000000000e2';
const MY_TEAM = '70000000-0000-4000-8000-0000000000f1';
const SPRINT_1 = '70000000-0000-4000-8000-0000000000c1';
const SPRINT_2 = '70000000-0000-4000-8000-0000000000c2';
const PROJECT = '70000000-0000-4000-8000-0000000000d1';

/** The modules every case reads, named so a leak names itself rather than moving a count. */
const MODULES = [
	{ id: '70000000-0000-4000-8000-000000000001', name: 'mine', tenantId: TENANT_A, organizationId: ORGANIZATION_A },
	{
		id: '70000000-0000-4000-8000-000000000002',
		name: 'colleague',
		tenantId: TENANT_A,
		organizationId: ORGANIZATION_A
	},
	{
		id: '70000000-0000-4000-8000-000000000003',
		name: 'mine-other-tenant',
		tenantId: TENANT_B,
		organizationId: ORGANIZATION_A
	},
	{
		id: '70000000-0000-4000-8000-000000000004',
		name: 'project',
		tenantId: TENANT_A,
		organizationId: ORGANIZATION_A,
		projectId: PROJECT
	},
	{
		id: '70000000-0000-4000-8000-000000000005',
		name: 'project-other-tenant',
		tenantId: TENANT_B,
		organizationId: ORGANIZATION_A,
		projectId: PROJECT
	}
];
const [MINE, COLLEAGUES, MINE_OTHER_TENANT] = MODULES;

const ModuleSchema = new EntitySchema<any>({
	name: 'OrganizationProjectModule',
	tableName: 'organization_project_module',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		status: { type: 'varchar', nullable: true },
		projectId: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		members: {
			type: 'one-to-many',
			target: 'OrganizationProjectModuleEmployee',
			inverseSide: 'organizationProjectModule'
		},
		teams: {
			type: 'many-to-many',
			target: 'OrganizationTeam',
			joinTable: {
				name: 'project_module_team',
				joinColumn: { name: 'organizationProjectModuleId' },
				inverseJoinColumn: { name: 'organizationTeamId' }
			}
		},
		organizationSprints: {
			type: 'many-to-many',
			target: 'OrganizationSprint',
			joinTable: {
				name: 'project_module_sprint',
				joinColumn: { name: 'organizationProjectModuleId' },
				inverseJoinColumn: { name: 'organizationSprintId' }
			}
		}
	}
});

const ModuleEmployeeSchema = new EntitySchema<any>({
	name: 'OrganizationProjectModuleEmployee',
	tableName: 'organization_project_module_employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		organizationProjectModuleId: { type: 'varchar' },
		employeeId: { type: 'varchar' }
	},
	relations: {
		organizationProjectModule: {
			type: 'many-to-one',
			target: 'OrganizationProjectModule',
			inverseSide: 'members',
			joinColumn: { name: 'organizationProjectModuleId' }
		}
	}
});

const TeamSchema = new EntitySchema<any>({
	name: 'OrganizationTeam',
	tableName: 'organization_team',
	columns: { id: { primary: true, type: 'varchar' } }
});

const TeamEmployeeSchema = new EntitySchema<any>({
	name: 'OrganizationTeamEmployee',
	tableName: 'organization_team_employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		organizationTeamId: { type: 'varchar' },
		employeeId: { type: 'varchar' }
	}
});

const SprintSchema = new EntitySchema<any>({
	name: 'OrganizationSprint',
	tableName: 'organization_sprint',
	columns: { id: { primary: true, type: 'varchar' } }
});

describe('OrganizationProjectModuleService — module lists by employee and by team on TypeORM (#10720)', () => {
	let dataSource: DataSource;
	let service: OrganizationProjectModuleService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [ModuleSchema, ModuleEmployeeSchema, TeamSchema, TeamEmployeeSchema, SprintSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		await dataSource.getRepository('OrganizationProjectModule').save(MODULES);
		await dataSource.getRepository('OrganizationProjectModuleEmployee').save([
			{ id: 'member-1', organizationProjectModuleId: MINE.id, employeeId: ME },
			{ id: 'member-2', organizationProjectModuleId: COLLEAGUES.id, employeeId: COLLEAGUE },
			{ id: 'member-3', organizationProjectModuleId: MINE_OTHER_TENANT.id, employeeId: ME }
		]);
		await dataSource.getRepository('OrganizationTeam').save([{ id: MY_TEAM }]);
		await dataSource
			.getRepository('OrganizationTeamEmployee')
			.save([{ id: 'team-member-1', organizationTeamId: MY_TEAM, employeeId: ME }]);
		await dataSource.getRepository('OrganizationSprint').save([{ id: SPRINT_1 }, { id: SPRINT_2 }]);
		await dataSource.query(
			'INSERT INTO "project_module_team" ("organizationProjectModuleId", "organizationTeamId") VALUES (?, ?), (?, ?)',
			[MINE.id, MY_TEAM, MINE_OTHER_TENANT.id, MY_TEAM]
		);
		await dataSource.query(
			'INSERT INTO "project_module_sprint" ("organizationProjectModuleId", "organizationSprintId") VALUES (?, ?)',
			[MINE.id, SPRINT_1]
		);

		const modules: Repository<any> = dataSource.getRepository('OrganizationProjectModule');
		service = new OrganizationProjectModuleService(
			dataSource,
			modules as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any
		);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ME);
		// An employee who may not act for other employees
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => permission !== PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The names of the modules one list answered, sorted. */
	const names = ({ items, total }: { items: any[]; total: number }): string[] => {
		expect(total).toBe(items.length);
		return items.map((item) => item.name).sort();
	};

	it("lists the caller's modules of the organization (GET /employee)", async () => {
		const answered = await service.getEmployeeProjectModules({ where: { organizationId: ORGANIZATION_A } } as any);

		expect(names(answered)).toEqual(['mine']);
	});

	it("lists the modules of the caller's teams (GET /team)", async () => {
		const answered = await service.findTeamProjectModules({
			where: { organizationId: ORGANIZATION_A, teams: [MY_TEAM] }
		} as any);

		expect(names(answered)).toEqual(['mine']);
	});

	it("lists the project's modules beside the teams' modules, within the caller's tenant only", async () => {
		const answered = await service.findTeamProjectModules({
			where: { organizationId: ORGANIZATION_A, teams: [MY_TEAM], projectId: PROJECT }
		} as any);

		expect(names(answered)).toEqual(['mine', 'project']);
	});

	it('lists the modules of a named employee (GET /employee/:id)', async () => {
		const read = (options: Partial<IOrganizationProjectModuleFindInput> = {}) =>
			service.findByEmployee(ME, {
				organizationId: ORGANIZATION_A,
				...options
			} as IOrganizationProjectModuleFindInput);

		expect(names(await read())).toEqual(['mine']);
		expect(names(await service.findByEmployee(COLLEAGUE, { organizationId: ORGANIZATION_A } as any))).toEqual([
			'colleague'
		]);
		// The sprint and team joins the filters read
		expect(names(await read({ organizationSprintId: SPRINT_1 }))).toEqual(['mine']);
		expect(names(await read({ organizationSprintId: SPRINT_2 }))).toEqual([]);
		expect(names(await read({ organizationTeamId: MY_TEAM }))).toEqual(['mine']);
	});
});
